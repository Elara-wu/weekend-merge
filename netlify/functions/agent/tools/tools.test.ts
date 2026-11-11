import { describe, expect, it } from "vitest";

import rawPlaces from "../../../../data/places.shanghai.json";
import { PlaceListSchema, type Place } from "./contracts";
import { calculateBudget } from "./budget";
import { searchPlaces } from "./places";
import { estimateRoute } from "./route";

const dailyHours: Place["weeklyOpeningHours"] = [{
  days: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
  intervals: [{ open: "11:00", close: "18:00" }],
}];

const fixturePlaces: Place[] = [
  {
    placeId: "west-bund-museum",
    name: "西岸美术馆",
    category: "exhibition",
    area: "徐汇滨江",
    address: "龙腾大道2600号",
    latitude: 31.171,
    longitude: 121.46,
    tags: ["展览", "艺术"],
    indoor: true,
    priceRange: { min: 0, max: 100 },
    weeklyOpeningHours: dailyHours,
    sourceUrl: "https://wbmshanghai.com/en/page/visit",
    lastVerifiedAt: "2026-11-11",
  },
  {
    placeId: "busy-gallery",
    name: "热门展馆",
    category: "exhibition",
    area: "徐汇滨江",
    address: "龙腾大道1号",
    latitude: 31.17,
    longitude: 121.46,
    tags: ["展览", "排队"],
    indoor: true,
    priceRange: { min: 0, max: 80 },
    weeklyOpeningHours: dailyHours,
    sourceUrl: "https://example.com/busy-gallery",
    lastVerifiedAt: "2026-11-11",
  },
  {
    placeId: "river-walk",
    name: "滨江步道",
    category: "night-view",
    area: "徐汇滨江",
    address: "龙腾大道",
    latitude: 31.175,
    longitude: 121.46,
    tags: ["夜景"],
    indoor: false,
    priceRange: { min: 0, max: 0 },
    weeklyOpeningHours: dailyHours,
    sourceUrl: "https://example.com/river-walk",
    lastVerifiedAt: "2026-11-11",
  },
];

describe("curated places", () => {
  it("keeps at least twelve complete, sourced Shanghai venues across all required categories", () => {
    const places = PlaceListSchema.parse(rawPlaces);

    expect(places.length).toBeGreaterThanOrEqual(12);
    expect(new Set(places.map((place) => place.placeId)).size).toBe(places.length);
    expect(new Set(places.map((place) => place.category))).toEqual(new Set([
      "exhibition", "bookstore", "cafe", "dinner", "park", "night-view",
    ]));
    expect(places.every((place) => place.lastVerifiedAt === "2026-11-11")).toBe(true);
  });
});

describe("searchPlaces", () => {
  it("filters by tags, price, indoors, area, and an entire opening interval", () => {
    const result = searchPlaces({
      requiredTags: ["展览"],
      excludedTags: ["排队"],
      maxPricePerPerson: 100,
      indoorPreference: "indoor",
      areas: ["徐汇滨江"],
      openBetween: {
        start: "2026-11-14T13:00:00+08:00",
        end: "2026-11-14T18:00:00+08:00",
      },
      limit: 5,
    }, fixturePlaces);

    expect(result.places.map((place) => place.placeId)).toEqual(["west-bund-museum"]);
  });

  it("excludes a venue when the requested interval extends beyond closing", () => {
    const result = searchPlaces({
      openBetween: {
        start: "2026-11-14T17:30:00+08:00",
        end: "2026-11-14T18:30:00+08:00",
      },
      limit: 5,
    }, fixturePlaces);

    expect(result.places).toEqual([]);
  });

  it("preserves source order and applies the limit", () => {
    const result = searchPlaces({ limit: 2 }, fixturePlaces);

    expect(result.places.map((place) => place.placeId)).toEqual(["west-bund-museum", "busy-gallery"]);
  });

  it("applies price, area, and outdoor filters independently", () => {
    const places = [
      fixturePlaces[0],
      { ...fixturePlaces[1], placeId: "expensive", priceRange: { min: 120, max: 180 } },
      { ...fixturePlaces[2], area: "外滩" },
    ];

    expect(searchPlaces({ maxPricePerPerson: 100, limit: 5 }, places).places.map((place) => place.placeId))
      .toEqual(["west-bund-museum", "river-walk"]);
    expect(searchPlaces({ areas: ["外滩"], limit: 5 }, places).places.map((place) => place.placeId))
      .toEqual(["river-walk"]);
    expect(searchPlaces({ indoorPreference: "outdoor", limit: 5 }, places).places.map((place) => place.placeId))
      .toEqual(["river-walk"]);
  });
});

describe("estimateRoute", () => {
  it("marks a long mixed-mode leg as estimated transit with a transfer buffer", () => {
    const result = estimateRoute({
      stops: [
        { placeId: "a", latitude: 31.2, longitude: 121.4 },
        { placeId: "b", latitude: 31.21, longitude: 121.41 },
      ],
      mode: "mixed",
    });

    expect(result.estimated).toBe(true);
    expect(result.legs).toMatchObject([{ mode: "transit", fromPlaceId: "a", toPlaceId: "b" }]);
    expect(result.totalDistanceKm).toBeGreaterThan(1.2);
    expect(result.totalDurationMinutes).toBeGreaterThan(8);
  });

  it("walks a short leg and totals multiple legs", () => {
    const result = estimateRoute({
      stops: [
        { placeId: "a", latitude: 31.2, longitude: 121.4 },
        { placeId: "b", latitude: 31.205, longitude: 121.4 },
        { placeId: "c", latitude: 31.22, longitude: 121.4 },
      ],
      mode: "mixed",
    });

    expect(result.legs.map((leg) => leg.mode)).toEqual(["walking", "transit"]);
    expect(result.totalDistanceKm).toBe(2.22);
    expect(result.totalDurationMinutes).toBe(result.legs[0].durationMinutes + result.legs[1].durationMinutes);
  });
});

describe("calculateBudget", () => {
  it("adds item quantities and a ten-percent buffer", () => {
    expect(calculateBudget({
      items: [{ category: "food", label: "晚餐", unitPrice: 100, quantity: 2 }],
      budgetLimit: 230,
      bufferRate: 0.1,
    })).toMatchObject({ subtotal: 200, buffer: 20, total: 220, withinBudget: true });
  });

  it("rounds currency and groups costs by category", () => {
    const result = calculateBudget({
      items: [
        { category: "food", label: "咖啡", unitPrice: 12.345, quantity: 2 },
        { category: "food", label: "甜点", unitPrice: 5, quantity: 1 },
        { category: "ticket", label: "展览", unitPrice: 30, quantity: 1 },
      ],
      budgetLimit: 65,
      bufferRate: 0.1,
    });

    expect(result).toMatchObject({
      subtotal: 59.69,
      buffer: 5.97,
      total: 65.66,
      withinBudget: false,
      breakdown: { food: 29.69, ticket: 30 },
    });
  });

  it("rejects a negative item price", () => {
    expect(() => calculateBudget({
      items: [{ category: "food", label: "晚餐", unitPrice: -1, quantity: 2 }],
      budgetLimit: 100,
      bufferRate: 0.1,
    })).toThrow();
  });
});

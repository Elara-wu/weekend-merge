import rawPlaces from "../../../../data/places.shanghai.json";

import {
  PlaceListSchema,
  SearchPlacesInputSchema,
  SearchPlacesOutputSchema,
  type Place,
  type SearchPlacesInput,
  type SearchPlacesOutput,
} from "./contracts";

export const shanghaiPlaces = PlaceListSchema.parse(rawPlaces);

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function minutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function openForInterval(place: Place, start: string, end: string): boolean {
  const localStart = Date.parse(start) + SHANGHAI_OFFSET_MS;
  const localEnd = Date.parse(end) + SHANGHAI_OFFSET_MS;
  const startMinute = (localStart % DAY_MS + DAY_MS) % DAY_MS / 60_000;
  if (place.lastAdmissionTime && startMinute > minutes(place.lastAdmissionTime)) {
    return false;
  }
  let cursor = localStart;

  while (cursor < localEnd) {
    const dayStart = Math.floor(cursor / DAY_MS) * DAY_MS;
    const segmentEnd = Math.min(localEnd, dayStart + DAY_MS);
    const weekday = WEEKDAYS[new Date(dayStart).getUTCDay()];
    const intervals = place.weeklyOpeningHours.find((entry) => entry.days.includes(weekday))?.intervals ?? [];
    const startMinute = (cursor - dayStart) / 60_000;
    const endMinute = (segmentEnd - dayStart) / 60_000;

    if (!intervals.some((window) => minutes(window.open) <= startMinute && minutes(window.close) >= endMinute)) {
      return false;
    }
    cursor = segmentEnd;
  }
  return true;
}

export function searchPlaces(input: SearchPlacesInput, places: readonly Place[] = shanghaiPlaces): SearchPlacesOutput {
  const query = SearchPlacesInputSchema.parse(input);
  const catalog = PlaceListSchema.parse(places);
  const result = catalog.filter((place) =>
    query.requiredTags.every((tag) => place.tags.includes(tag)) &&
    query.excludedTags.every((tag) => !place.tags.includes(tag)) &&
    (query.maxPricePerPerson === undefined || place.priceRange.max <= query.maxPricePerPerson) &&
    (query.indoorPreference === "any" || place.indoor === (query.indoorPreference === "indoor")) &&
    (query.areas.length === 0 || query.areas.includes(place.area)) &&
    (!query.openBetween || openForInterval(place, query.openBetween.start, query.openBetween.end))
  ).slice(0, query.limit);

  return SearchPlacesOutputSchema.parse({ places: result });
}

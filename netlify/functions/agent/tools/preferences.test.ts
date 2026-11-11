import { describe, expect, it } from "vitest";

import { shanghaiPlaces } from "./places";
import { expandedAvoidTags, interestMatchesTags, effectiveWalkingLimitKm, violatesAvoidedStop } from "./preferences";

describe("preference semantics", () => {
  it.each([
    ["展览", ["展览", "艺术", "当代艺术", "历史", "文物", "文化"]],
    ["咖啡", ["咖啡", "烘焙", "休息"]],
    ["城市散步", ["散步", "江景", "文化"]],
    ["自然", ["公园", "绿地", "江景"]],
    ["电影", ["电影"]],
    ["桌游", ["桌游"]],
    ["夜景", ["夜景", "江景"]],
    ["逛店", ["书店", "阅读", "文化"]],
    ["美食", ["晚餐", "本帮菜", "传统"]],
  ])("matches every catalog tag for UI interest %s", (interest, tags) => {
    for (const tag of tags) expect(interestMatchesTags(interest, [tag])).toBe(true);
    expect(interestMatchesTags(interest, ["无关"])).toBe(false);
  });

  it("expands semantic avoid labels without discarding literal tags", () => {
    expect(expandedAvoidTags(["拥挤", "辛辣", "自定义"])).toEqual([
      "拥挤", "排队", "辛辣", "川菜", "火锅", "自定义",
    ]);
  });

  it("finds no curated movie or board-game venue", () => {
    for (const place of shanghaiPlaces) {
      expect(interestMatchesTags("电影", place.tags)).toBe(false);
      expect(interestMatchesTags("桌游", place.tags)).toBe(false);
    }
  });

  it("caps walking distance and applies time and sunlight avoidances", () => {
    expect(effectiveWalkingLimitKm({ a: { walkingLimitKm: 3, avoid: ["长距离步行"] }, b: { walkingLimitKm: 5, avoid: [] } })).toBe(1);
    expect(violatesAvoidedStop(["早起"], [], true, "09:59")).toBe(true);
    expect(violatesAvoidedStop(["早起"], [], true, "10:00")).toBe(false);
    expect(violatesAvoidedStop(["户外日晒"], [], false, "17:59")).toBe(true);
    expect(violatesAvoidedStop(["户外日晒"], [], false, "18:00")).toBe(false);
  });
});

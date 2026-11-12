import { describe, expect, it } from "vitest";
import { parseReplanFeedback } from "./replanFeedback";

describe("deterministic replan feedback protocol", () => {
  it.each([
    ["another exhibition", ["展览"], []],
    ["no exhibition, coffee instead", ["咖啡"], ["展览"]],
    ["不要再安排展览，想喝咖啡", ["咖啡"], ["展览"]],
  ])("separates positive and negative interest tokens in %s", (reason, desired, negative) => {
    expect(parseReplanFeedback({ reason })).toMatchObject({ desired, negative });
  });
  it.each([
    ["crowd and queue", "TOO_CROWDED"], ["expensive, over budget", "TOO_EXPENSIVE"],
    ["far", "TOO_MUCH_WALKING"], ["rain", "PREFER_INDOOR"], ["outdoor", "PREFER_OUTDOOR"],
    ["same category", "CHANGE_PLACE"],
  ])("maps bounded legacy keyword %s", (reason, code) => {
    expect(parseReplanFeedback({ reason })?.code).toBe(code);
  });
  it("uses word boundaries and does not claim arbitrary natural language was understood", () => {
    expect(parseReplanFeedback({ reason: "I want a unique experience" })).toBeUndefined();
    expect(parseReplanFeedback({ reason: "notebook memories" })).toBeUndefined();
  });

  it.each([
    ["不要室内，想去户外", "PREFER_OUTDOOR", false],
    ["不要户外，想去室内", "PREFER_INDOOR", true],
  ])("respects negated space preferences in %s", (reason, code, indoor) => {
    expect(parseReplanFeedback({ reason })).toMatchObject({ code, indoor });
  });
});

it.each(["training schedule", "crowdfunding project", "outdoorsman biography", "coffeemaker repair"])(
  "does not infer supported English feedback from a substring in %s", (reason) => {
    expect(parseReplanFeedback({ reason })).toBeUndefined();
  },
);

it("combines an explicit activity with a cost preference instead of discarding the cost feedback", () => {
  expect(parseReplanFeedback({ reason: "coffee is too expensive" })).toMatchObject({ code: "TOO_EXPENSIVE", desired: ["咖啡"] });
});

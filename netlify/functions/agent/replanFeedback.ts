import { InterestSchema, type ReplanReasonCode, type ReplanRequest } from "../../../src/contracts/agent";
import type { Place } from "./tools/contracts";
import { interestMatchesTags } from "./tools/preferences";

type Interest = typeof InterestSchema.enum[keyof typeof InterestSchema.enum];
export type ReplanFeedback = {
  code: ReplanReasonCode;
  desired: Interest[];
  negative: Interest[];
  sameCategory: boolean;
  crowded: boolean;
  indoor?: boolean;
};
const aliases: Record<Interest, string> = {
  "展览": "展览|看展|exhibition|museum", "咖啡": "咖啡|coffee|cafe", "城市散步": "城市散步|city walk",
  "自然": "自然|nature|park", "电影": "电影|movie|cinema", "桌游": "桌游|board game",
  "夜景": "夜景|night view", "逛店": "逛店|书店|bookstore|shopping", "美食": "美食|晚餐|food|dinner",
};
const clauseSeparator = /[，,。.;；!?！？]|\b(?:but|instead)\b/;
const negativePrefix = /(?:不要|不想|不再|别|拒绝|\b(?:avoid|no|not|don't|do not|without)\b)[^，,。;；]*$/i;

function parseIndoorPreference(text: string): boolean | undefined {
  const votes = new Set<boolean>();
  const patterns: Array<{ expression: RegExp; indoor: boolean }> = [
    { expression: /室内|\bindoors?\b/i, indoor: true },
    { expression: /户外|室外|\boutdoors?\b/i, indoor: false },
    { expression: /下雨|雨天|\brain(?:y|ing)?\b/i, indoor: true },
  ];

  for (const clause of text.split(clauseSeparator)) {
    for (const pattern of patterns) {
      const match = pattern.expression.exec(clause);
      if (!match) continue;
      const negated = negativePrefix.test(clause.slice(0, match.index));
      // Negating rain does not imply an outdoor preference; negating a space type does.
      if (negated && pattern.indoor && /下雨|雨天|\brain/i.test(match[0])) continue;
      votes.add(negated ? !pattern.indoor : pattern.indoor);
    }
  }

  return votes.size === 1 ? [...votes][0] : undefined;
}

// Bounded keyword protocol, deliberately not a general natural-language interpreter.
export function parseReplanFeedback(request: Pick<ReplanRequest, "reason" | "reasonCode">): ReplanFeedback | undefined {
  const text = request.reason.toLowerCase();
  const desired: Interest[] = [];
  const negative: Interest[] = [];
  for (const clause of text.split(clauseSeparator)) {
    for (const interest of InterestSchema.options) {
      const tokens = aliases[interest].split("|").map((alias) => /^[a-z]/.test(alias) ? `\\b${alias}\\b` : alias);
      const match = new RegExp(tokens.join("|"), "i").exec(clause);
      if (!match) continue;
      const prefix = clause.slice(0, match.index);
      const isNegative = negativePrefix.test(prefix);
      (isNegative ? negative : desired).push(interest);
    }
  }
  const crowded = /排队|拥挤|人多|\b(?:crowd(?:ed|s|ing)?|queue(?:s|ing)?)\b/.test(text);
  const expensive = /贵|省钱|预算|\b(?:expensive|budget|cheaper)\b/.test(text);
  const walking = /走路|步行|太远|远了|\b(?:walking|walk too|far)\b/.test(text);
  const indoorPreference = parseIndoorPreference(text);
  const indoor = indoorPreference === true;
  const outdoor = indoorPreference === false;
  const sameCategory = /另一个|另一家|换一个|同类|同类别|\b(?:another|same category)\b/.test(text);
  const code = request.reasonCode ?? (crowded ? "TOO_CROWDED" : expensive ? "TOO_EXPENSIVE" : walking ? "TOO_MUCH_WALKING" :
    indoor ? "PREFER_INDOOR" : outdoor ? "PREFER_OUTDOOR" : desired.length || negative.length ? "CHANGE_ACTIVITY" :
    sameCategory ? "CHANGE_PLACE" : undefined);
  if (!code) return undefined;
  const preference = code === "PREFER_INDOOR" ? true : code === "PREFER_OUTDOOR" ? false : indoor ? true : outdoor ? false : undefined;
  return { code, desired: [...new Set(desired)], negative: [...new Set(negative)], sameCategory,
    crowded: code === "TOO_CROWDED" || crowded, ...(preference === undefined ? {} : { indoor: preference }) };
}

function feedbackMatches(interest: Interest, place: Place): boolean {
  // Explicit category feedback is narrower than the broad planning preference aliases.
  if (interest === "展览") return place.category === "exhibition";
  if (interest === "咖啡") return place.tags.includes("咖啡");
  if (interest === "逛店") return place.category === "bookstore";
  if (interest === "美食") return place.category === "dinner";
  if (interest === "自然") return place.category === "park";
  if (interest === "夜景") return place.category === "night-view";
  return interestMatchesTags(interest, place.tags);
}
export function acceptsFeedback(place: Place, rejected: Place, feedback: ReplanFeedback): boolean {
  return (!feedback.crowded || !place.tags.some((tag) => tag === "排队" || tag === "拥挤")) &&
    (feedback.indoor === undefined || place.indoor === feedback.indoor) &&
    !feedback.negative.some((interest) => feedbackMatches(interest, place)) &&
    (!feedback.desired.length || feedback.desired.some((interest) => feedbackMatches(interest, place))) &&
    (!feedback.sameCategory || feedback.desired.length > 0 || place.category === rejected.category) &&
    (feedback.code !== "CHANGE_ACTIVITY" || feedback.desired.length > 0 || feedback.sameCategory || place.category !== rejected.category);
}
export const feedbackDescriptions: Record<ReplanReasonCode, string> = {
  CHANGE_PLACE: "已更换地点", TOO_CROWDED: "避开排队和拥挤标签", TOO_EXPENSIVE: "优先降低地点费用",
  TOO_MUCH_WALKING: "优先减少相邻地点距离", PREFER_INDOOR: "替换为室内地点", PREFER_OUTDOOR: "替换为户外地点",
  CHANGE_ACTIVITY: "已按指定活动偏好更换",
};

import {
  ConsensusSummarySchema,
  type ConsensusSummary,
  type PlanRequest,
} from "../../../../src/contracts/agent";
import { effectiveWalkingLimitKm } from "../tools/preferences";

export function analyzeConsensus(request: PlanRequest): ConsensusSummary {
  const { a, b } = request.preferences;
  const shared = [...new Set(a.interests)].filter((interest) => b.interests.includes(interest));
  const conflicts: string[] = [];
  if (a.pace !== b.pace) conflicts.push(`节奏偏好不同：${a.pace} / ${b.pace}`);
  if (a.indoorPreference !== b.indoorPreference) {
    conflicts.push(`室内外偏好不同：${a.indoorPreference} / ${b.indoorPreference}`);
  }
  if (a.walkingLimitKm !== b.walkingLimitKm) {
    conflicts.push(`步行上限不同：${a.walkingLimitKm} / ${b.walkingLimitKm} 公里`);
  }

  const avoided = [...new Set([...a.avoid, ...b.avoid])];
  const constraints = [
    `总预算 ${request.setup.budget} 元`,
    `步行上限 ${effectiveWalkingLimitKm(request.preferences)} 公里`,
    `活动时间 ${request.setup.startTime}-${request.setup.endTime}`,
    ...avoided.map((tag) => `避开：${tag}`),
  ];
  return ConsensusSummarySchema.parse({ shared, conflicts, constraints });
}

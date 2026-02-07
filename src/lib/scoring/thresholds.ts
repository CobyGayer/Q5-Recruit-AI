import type { Recruit, ProgramConfig } from "@/types/database";

export interface ThresholdResult {
  qualified: boolean;
  reasons: string[];
}

/**
 * Check recruit against coach's configured minimum thresholds.
 * Only checks fields that are PRESENT — missing data does NOT disqualify.
 */
export function checkThresholds(
  recruit: Recruit,
  config: ProgramConfig
): ThresholdResult {
  const reasons: string[] = [];

  // GPA check (only if recruit has GPA and coach has minimum)
  if (config.min_gpa != null && recruit.gpa != null) {
    if (recruit.gpa < config.min_gpa) {
      reasons.push(
        `GPA ${recruit.gpa} is below minimum ${config.min_gpa}`
      );
    }
  }

  // SAT check
  if (config.min_sat != null && recruit.sat_score != null) {
    if (recruit.sat_score < config.min_sat) {
      reasons.push(
        `SAT ${recruit.sat_score} is below minimum ${config.min_sat}`
      );
    }
  }

  // ACT check
  if (config.min_act != null && recruit.act_score != null) {
    if (recruit.act_score < config.min_act) {
      reasons.push(
        `ACT ${recruit.act_score} is below minimum ${config.min_act}`
      );
    }
  }

  // Height check (per position)
  if (
    recruit.height_inches != null &&
    recruit.positions.length > 0 &&
    config.min_height_by_position &&
    Object.keys(config.min_height_by_position).length > 0
  ) {
    for (const position of recruit.positions) {
      const minHeight = config.min_height_by_position[position];
      if (minHeight != null && recruit.height_inches < minHeight) {
        reasons.push(
          `Height ${recruit.height_inches}" for ${position} is below minimum ${minHeight}"`
        );
      }
    }
  }

  // Graduation year check
  if (
    recruit.graduation_year != null &&
    config.accepted_grad_years.length > 0
  ) {
    if (!config.accepted_grad_years.includes(recruit.graduation_year)) {
      reasons.push(
        `Graduation year ${recruit.graduation_year} is not in accepted years`
      );
    }
  }

  // Position check
  if (
    recruit.positions.length > 0 &&
    config.accepted_positions.length > 0
  ) {
    const hasMatchingPosition = recruit.positions.some((pos) =>
      config.accepted_positions.includes(pos)
    );
    if (!hasMatchingPosition) {
      reasons.push(
        `Position(s) ${recruit.positions.join(", ")} not in accepted positions`
      );
    }
  }

  return {
    qualified: reasons.length === 0,
    reasons,
  };
}

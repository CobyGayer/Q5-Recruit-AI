import type { Recruit, ProgramConfig, TranscriptAnalysis } from "@/types/database";
import { checkThresholds } from "./thresholds";
import {
  scoreAcademic,
  scoreCompetition,
  scorePhysical,
  scorePositionFit,
  scoreGradYearFit,
  calculateBonus,
} from "./components";
import { adjustCompletenessForWeights } from "./completeness";

export interface DQSResult {
  score: number | null;
  isQualified: boolean;
  disqualificationReasons: string[];
  componentScores: {
    academic: number | null;
    competition: number | null;
    physical: number | null;
    positionFit: number | null;
    gradYear: number | null;
    completeness: number | null;
  };
  bonusPoints: number;
  completenessPenalty: number;
  breakdown: Record<string, unknown>;
}

interface WeightConfig {
  academic: number;
  competition: number;
  physical: number;
  positionFit: number;
  gradYear: number;
  completeness: number;
}

/**
 * Convert numeric weights to normalized percentages.
 * Redistributes weight from components with missing data.
 */
function normalizeWeights(
  weightConfig: WeightConfig,
  availableComponents: Record<string, boolean>
): Record<string, number> {
  const rawWeights: Record<string, number> = {};
  let total = 0;

  for (const [key, weight] of Object.entries(weightConfig)) {
    if (availableComponents[key] && (weight as number) > 0) {
      rawWeights[key] = weight as number;
      total += weight as number;
    }
  }

  // Normalize to sum to 1.0
  const normalized: Record<string, number> = {};
  for (const [key, weight] of Object.entries(rawWeights)) {
    normalized[key] = total > 0 ? weight / total : 0;
  }

  return normalized;
}

/**
 * Calculate the Dynamic Qualification Score (DQS) for a recruit
 * against a coach's program configuration.
 */
export function calculateDQS(
  recruit: Recruit,
  config: ProgramConfig,
  transcriptAnalysis?: TranscriptAnalysis | null
): DQSResult {
  const adjustedCompleteness = adjustCompletenessForWeights(
    recruit.fields_missing,
    recruit.fields_extracted,
    recruit.fields_total,
    config,
    recruit.club_level
  );

  // Step 1: Threshold check
  const thresholdResult = checkThresholds(recruit, config);

  if (!thresholdResult.qualified) {
    return {
      score: null,
      isQualified: false,
      disqualificationReasons: thresholdResult.reasons,
      componentScores: {
        academic: scoreAcademic(recruit, transcriptAnalysis),
        competition: scoreCompetition(recruit),
        physical: scorePhysical(recruit, config),
        positionFit: scorePositionFit(recruit, config),
        gradYear: scoreGradYearFit(recruit, config),
        completeness: adjustedCompleteness.percent,
      },
      bonusPoints: 0,
      completenessPenalty: 0,
      breakdown: { disqualified: true, reasons: thresholdResult.reasons },
    };
  }

  // Step 2: Calculate component scores
  const componentScores = {
    academic: scoreAcademic(recruit, transcriptAnalysis),
    competition: scoreCompetition(recruit),
    physical: scorePhysical(recruit, config),
    positionFit: scorePositionFit(recruit, config),
    gradYear: scoreGradYearFit(recruit, config),
    completeness: adjustedCompleteness.percent,
  };

  // Step 3: Determine which components have data
  const availableComponents: Record<string, boolean> = {
    academic: componentScores.academic != null,
    competition: componentScores.competition != null,
    physical: componentScores.physical != null,
    positionFit: componentScores.positionFit != null,
    gradYear: componentScores.gradYear != null,
    completeness: true, // Always available
  };

  // Step 4: Normalize weights (redistribute from missing components)
  const weightConfig: WeightConfig = {
    academic: config.weight_academic,
    competition: config.weight_competition,
    physical: config.weight_physical,
    positionFit: config.weight_position_fit,
    gradYear: config.weight_grad_year,
    completeness: config.weight_completeness,
  };

  const weights = normalizeWeights(weightConfig, availableComponents);

  // Step 5: Calculate weighted score
  let weightedScore = 0;
  const breakdownDetails: Record<string, { score: number | null; weight: number; weighted: number }> = {};

  for (const [key, score] of Object.entries(componentScores)) {
    const weight = weights[key] ?? 0;
    const effective = score ?? 0;
    const weighted = effective * weight;
    weightedScore += weighted;
    breakdownDetails[key] = { score, weight, weighted };
  }

  // Step 6: Bonus modifiers
  const bonus = calculateBonus(recruit, config);

  // Step 7: Completeness penalty
  const completenessRatio =
    config.weight_completeness > 0 ? adjustedCompleteness.ratio : 1;
  // Penalty multiplier: 0.6 (0% complete) to 1.0 (100% complete)
  const penaltyMultiplier = 0.6 + 0.4 * completenessRatio;

  // Step 8: Final score
  const finalScore = Math.min(
    100,
    Math.max(0, (weightedScore + bonus.points) * penaltyMultiplier)
  );

  return {
    score: Math.round(finalScore * 100) / 100,
    isQualified: true,
    disqualificationReasons: [],
    componentScores,
    bonusPoints: bonus.points,
    completenessPenalty: Math.round((1 - penaltyMultiplier) * 100),
    breakdown: {
      components: breakdownDetails,
      bonus: bonus.reasons,
      completenessRatio,
      penaltyMultiplier,
      rawWeightedScore: weightedScore,
      finalScore,
    },
  };
}

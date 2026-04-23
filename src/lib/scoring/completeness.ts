import type { ClubLevel, ProgramConfig } from "@/types/database";

type WeightKeys = Pick<
  ProgramConfig,
  | "weight_academic"
  | "weight_competition"
  | "weight_physical"
  | "weight_position_fit"
  | "weight_grad_year"
  | "weight_completeness"
>;

export interface AdjustedCompleteness {
  missing: string[];
  extracted: number;
  total: number;
  ratio: number;
  percent: number;
}

const WEIGHTED_FIELDS = {
  academic: ["gpa", "sat_score", "act_score"],
  competition: ["club_team", "club_level"],
  physical: ["height_inches", "weight_lbs"],
  positionFit: ["positions"],
  gradYear: ["graduation_year"],
} as const;

function adjustForAlternativeTestFields(
  missing: string[],
  extracted: number,
  total: number
): { missing: string[]; extracted: number; total: number } {
  const hasMissingSat = missing.includes("sat_score");
  const hasMissingAct = missing.includes("act_score");

  // If exactly one test score is missing, SAT/ACT already behaves as an either-or requirement.
  if (hasMissingSat !== hasMissingAct) {
    const drop = hasMissingSat ? "sat_score" : "act_score";
    return {
      missing: missing.filter((f) => f !== drop),
      extracted,
      total: Math.max(0, total - 1),
    };
  }

  return { missing, extracted, total };
}

function adjustForUnknownClubLevel(
  missing: string[],
  extracted: number,
  clubLevel?: ClubLevel | null
): { missing: string[]; extracted: number } {
  if (clubLevel !== "unknown" || missing.includes("club_level")) {
    return { missing, extracted };
  }

  return {
    missing: [...missing, "club_level"],
    extracted: Math.max(0, extracted - 1),
  };
}

function getExcludedFields(weights?: WeightKeys | null): Set<string> {
  const excluded = new Set<string>();
  if (!weights) return excluded;

  if (weights.weight_academic === 0) {
    for (const field of WEIGHTED_FIELDS.academic) excluded.add(field);
  }
  if (weights.weight_competition === 0) {
    for (const field of WEIGHTED_FIELDS.competition) excluded.add(field);
  }
  if (weights.weight_physical === 0) {
    for (const field of WEIGHTED_FIELDS.physical) excluded.add(field);
  }
  if (weights.weight_position_fit === 0) {
    for (const field of WEIGHTED_FIELDS.positionFit) excluded.add(field);
  }
  if (weights.weight_grad_year === 0) {
    for (const field of WEIGHTED_FIELDS.gradYear) excluded.add(field);
  }

  return excluded;
}

export function adjustCompletenessForWeights(
  fieldsMissing: string[],
  fieldsExtracted: number,
  fieldsTotal: number,
  weights?: WeightKeys | null,
  clubLevel?: ClubLevel | null
): AdjustedCompleteness {
  const withClubLevelAdjustment = adjustForUnknownClubLevel(
    [...fieldsMissing],
    fieldsExtracted,
    clubLevel
  );

  const initial = adjustForAlternativeTestFields(
    withClubLevelAdjustment.missing,
    withClubLevelAdjustment.extracted,
    fieldsTotal
  );

  const excluded = getExcludedFields(weights);
  if (excluded.size === 0) {
    const ratio = initial.total > 0 ? initial.extracted / initial.total : 0;
    return {
      missing: initial.missing,
      extracted: initial.extracted,
      total: initial.total,
      ratio,
      percent: Math.round(ratio * 100),
    };
  }

  let adjustedMissing = [...initial.missing];
  let adjustedExtracted = initial.extracted;
  let adjustedTotal = initial.total;

  const excludesAcademic = excluded.has("gpa") && excluded.has("sat_score") && excluded.has("act_score");

  // Handle SAT/ACT together because they collapse to a single requirement when only one exists.
  if (excludesAcademic) {
    const hasMissingSat = adjustedMissing.includes("sat_score");
    const hasMissingAct = adjustedMissing.includes("act_score");

    if (hasMissingSat && hasMissingAct) {
      adjustedMissing = adjustedMissing.filter(
        (f) => f !== "sat_score" && f !== "act_score"
      );
      adjustedTotal = Math.max(0, adjustedTotal - 2);
    } else if (!hasMissingSat && !hasMissingAct) {
      // In this state, SAT/ACT contributes either 1 slot (either-or adjusted) or 2 slots.
      const testSlots = adjustedTotal >= 19 ? 2 : 1;
      adjustedTotal = Math.max(0, adjustedTotal - testSlots);
      adjustedExtracted = Math.max(0, adjustedExtracted - testSlots);
    }
  }

  const nonTestExcluded = [...excluded].filter(
    (f) => f !== "sat_score" && f !== "act_score"
  );

  for (const field of nonTestExcluded) {
    if (adjustedMissing.includes(field)) {
      adjustedMissing = adjustedMissing.filter((f) => f !== field);
      adjustedTotal = Math.max(0, adjustedTotal - 1);
      continue;
    }

    adjustedTotal = Math.max(0, adjustedTotal - 1);
    adjustedExtracted = Math.max(0, adjustedExtracted - 1);
  }

  const ratio = adjustedTotal > 0 ? adjustedExtracted / adjustedTotal : 0;
  return {
    missing: adjustedMissing,
    extracted: adjustedExtracted,
    total: adjustedTotal,
    ratio,
    percent: Math.round(ratio * 100),
  };
}

export function getCompletenessRatioForWeights(
  fieldsMissing: string[],
  fieldsExtracted: number,
  fieldsTotal: number,
  weights?: WeightKeys | null,
  clubLevel?: ClubLevel | null
): number {
  return adjustCompletenessForWeights(
    fieldsMissing,
    fieldsExtracted,
    fieldsTotal,
    weights,
    clubLevel
  ).ratio;
}
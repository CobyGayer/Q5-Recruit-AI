const RECRUIT_COMPLETENESS_FIELDS = [
  "full_name",
  "email",
  "phone",
  "graduation_year",
  "current_school",
  "city",
  "state",
  "country",
  "positions",
  "preferred_foot",
  "height_inches",
  "weight_lbs",
  "gpa",
  "sat_score",
  "act_score",
  "club_team",
  "club_level",
  "high_school_team",
  "video_url",
] as const;

type CompletenessField = (typeof RECRUIT_COMPLETENESS_FIELDS)[number];

function hasExtractedValue(field: CompletenessField, value: unknown): boolean {
  if (field === "positions") {
    return Array.isArray(value) && value.length > 0;
  }

  return value != null;
}

export interface CompletenessMetadata {
  fields_missing: string[];
  fields_extracted: number;
  fields_total: number;
}

export function computeCompletenessMetadata(
  recruit: Record<string, unknown>
): CompletenessMetadata {
  const missing: string[] = [];
  let extracted = 0;

  for (const field of RECRUIT_COMPLETENESS_FIELDS) {
    if (hasExtractedValue(field, recruit[field])) {
      extracted++;
    } else {
      missing.push(field);
    }
  }

  let total: number = RECRUIT_COMPLETENESS_FIELDS.length;
  const hasSat = hasExtractedValue("sat_score", recruit.sat_score);
  const hasAct = hasExtractedValue("act_score", recruit.act_score);

  // SAT/ACT is treated as either-or when exactly one score is available.
  if ((hasSat && !hasAct) || (!hasSat && hasAct)) {
    total = Math.max(0, total - 1);
    const droppedMissingField = hasSat ? "act_score" : "sat_score";
    const index = missing.indexOf(droppedMissingField);
    if (index !== -1) {
      missing.splice(index, 1);
    }
  }

  return {
    fields_missing: missing,
    fields_extracted: extracted,
    fields_total: total,
  };
}

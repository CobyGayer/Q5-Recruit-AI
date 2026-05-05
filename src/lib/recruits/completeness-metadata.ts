import { EXTRACTABLE_FIELDS } from "@/lib/extraction/extract";

type CompletenessField = (typeof EXTRACTABLE_FIELDS)[number];

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

  for (const field of EXTRACTABLE_FIELDS) {
    if (hasExtractedValue(field, recruit[field])) {
      extracted++;
    } else {
      missing.push(field);
    }
  }

  const hasSat = hasExtractedValue("sat_score", recruit.sat_score);
  const hasAct = hasExtractedValue("act_score", recruit.act_score);
  const hasTestScore = hasSat || hasAct;

  let total: number = EXTRACTABLE_FIELDS.length - 1;

  // SAT/ACT count as a single completeness slot. When both are present, the
  // pair still contributes only once to the completeness total.
  if (hasTestScore) {
    if (hasSat && hasAct) {
      extracted--;
    } else {
      const droppedMissingField = hasSat ? "act_score" : "sat_score";
      const index = missing.indexOf(droppedMissingField);
      if (index !== -1) {
        missing.splice(index, 1);
      }
    }
  }

  return {
    fields_missing: missing,
    fields_extracted: extracted,
    fields_total: total,
  };
}

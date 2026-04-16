import type { ConfidenceLevel } from "@/types/database";
import { CONFIDENCE_RANK } from "./confidence";

/**
 * Build a partial update payload for an existing recruit row.
 * Fields are only overwritten when the incoming extraction has equal or
 * higher confidence than whatever is already stored.
 *
 * This is the canonical confidence-merge implementation shared by the
 * ingest path, the retry path, and the name-based merge path.
 */
export function buildUpdateData(
  existing: Record<string, unknown>,
  newData: Record<string, unknown>,
  newConfidence: Record<string, ConfidenceLevel>
): Record<string, unknown> {
  const existingConfidence = (existing.extraction_confidence ?? {}) as Record<
    string,
    ConfidenceLevel
  >;

  const update: Record<string, unknown> = {};
  // Track which fields actually won the confidence battle so we only persist
  // confidence for fields whose values we are overwriting.
  const winnerConf: Record<string, ConfidenceLevel> = {};

  for (const [field, value] of Object.entries(newData)) {
    if (
      field === "extraction_confidence" ||
      field === "fields_missing" ||
      field === "fields_extracted" ||
      field === "fields_total"
    ) {
      continue; // handled separately below
    }

    if (value == null) continue; // never overwrite with null/undefined

    const existingConf = existingConfidence[field];
    const newConf = newConfidence[field];

    if (!existingConf || !newConf) {
      // No confidence metadata on either side — overwrite if we have a value
      update[field] = value;
      if (newConf) winnerConf[field] = newConf;
    } else if (CONFIDENCE_RANK[newConf] >= CONFIDENCE_RANK[existingConf]) {
      update[field] = value;
      winnerConf[field] = newConf;
    }
    // Otherwise keep existing (higher-confidence) value — don't downgrade confidence
  }

  // Merge confidence only for fields that were actually overwritten
  update.extraction_confidence = {
    ...existingConfidence,
    ...winnerConf,
  };
  update.fields_missing = newData.fields_missing;
  update.fields_extracted = newData.fields_extracted;
  update.fields_total = newData.fields_total;

  return update;
}

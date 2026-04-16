import type { Recruit, ConfidenceLevel } from "@/types/database";
import { CONFIDENCE_RANK } from "./confidence";

/** Scalar fields on a recruit that participate in the field-level merge. */
const MERGEABLE_FIELDS: Array<keyof Recruit> = [
  "email",
  "full_name",
  "phone",
  "graduation_year",
  "current_school",
  "city",
  "state",
  "country",
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
];

/**
 * Choose the survivor among a set of recruit records.
 * Primary: the record with the most fields extracted (completeness).
 * Tie-breaker: the most recently updated record.
 *
 * The survivor's identity (id, coach_id, program_id) is preserved;
 * its field values are then merged from all sources.
 */
export function chooseSurvivor(recruits: Recruit[]): Recruit {
  if (recruits.length === 0) throw new Error("chooseSurvivor requires at least one recruit");
  return recruits.reduce((best, r) => {
    if (r.fields_extracted > best.fields_extracted) return r;
    if (
      r.fields_extracted === best.fields_extracted &&
      new Date(r.updated_at) > new Date(best.updated_at)
    )
      return r;
    return best;
  });
}

/**
 * Build the merged field payload for the survivor recruit.
 *
 * Merge semantics for each scalar field:
 *   1. Prefer higher-confidence extracted value.
 *   2. On confidence tie, prefer the newer source (updated_at).
 *   3. Never overwrite a populated value with null/blank.
 *
 * For array fields (positions), take the union.
 * Extraction confidence is merged as a union — newer/higher wins per-key.
 */
export function buildMergedPayload(
  recruits: Recruit[]
): Partial<Recruit> & { extraction_confidence: Record<string, ConfidenceLevel> } {
  if (recruits.length === 0) throw new Error("buildMergedPayload requires at least one recruit");
  const merged: Record<string, unknown> = {};
  // mergedConfidence: the final confidence metadata stored on the recruit row (union of all sources)
  const mergedConfidence: Record<string, ConfidenceLevel> = {};
  // winnerConf: confidence of the value *currently stored* in merged[field] — kept separate so
  // the confidence comparison below is not corrupted by the mergedConfidence mutation that
  // happens earlier in the same loop iteration for the current recruit.
  const winnerConf: Record<string, ConfidenceLevel | undefined> = {};

  // Process recruits in recency order (oldest first so newest wins on tie)
  const sorted = [...recruits].sort(
    (a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
  );

  for (const recruit of sorted) {
    const conf = (recruit.extraction_confidence ?? {}) as Record<string, ConfidenceLevel>;

    // Merge scalar fields first, before mutating mergedConfidence, so that
    // existingConf (read from winnerConf) still reflects the previous winner's
    // confidence rather than the current recruit's confidence.
    for (const field of MERGEABLE_FIELDS) {
      const value = recruit[field];
      if (value == null) continue; // never overwrite with null

      const existingValue = merged[field as string];
      const existingConf = winnerConf[field as string]; // confidence of current winner
      const newConf = conf[field as string];

      if (existingValue == null) {
        // Field not yet set — take this value
        merged[field as string] = value;
        winnerConf[field as string] = newConf;
      } else if (!existingConf || !newConf) {
        // No confidence data on one side — newer source wins (sorted oldest→newest)
        merged[field as string] = value;
        winnerConf[field as string] = newConf;
      } else if (CONFIDENCE_RANK[newConf] > CONFIDENCE_RANK[existingConf]) {
        merged[field as string] = value;
        winnerConf[field as string] = newConf;
      } else if (CONFIDENCE_RANK[newConf] === CONFIDENCE_RANK[existingConf]) {
        // Tie in confidence — newer source wins (current recruit is newer because sorted asc)
        merged[field as string] = value;
        winnerConf[field as string] = newConf;
      }
      // Otherwise keep the current best value
    }

    // Update the confidence metadata map after field selection so it does not
    // interfere with the winnerConf comparisons above.
    for (const [field, level] of Object.entries(conf)) {
      const existing = mergedConfidence[field];
      if (!existing || CONFIDENCE_RANK[level] >= CONFIDENCE_RANK[existing]) {
        mergedConfidence[field] = level;
      }
    }
  }

  // Union of all positions arrays
  const allPositions = sorted.flatMap((r) => r.positions ?? []);
  const positions = [...new Set(allPositions)];

  // Recompute completeness metadata from the merged result —
  // this will be regenerated properly by DQS recalculation, but we set
  // consistent values so the row is not misleadingly stale before DQS runs.
  const mergedMissing = (MERGEABLE_FIELDS.filter(
    (f) => merged[f as string] == null
  ) as string[]).concat(positions.length === 0 ? ["positions"] : []);
  const mergedExtracted =
    MERGEABLE_FIELDS.filter((f) => merged[f as string] != null).length +
    (positions.length > 0 ? 1 : 0);
  // Use the newest source's fields_total so the sat/act mutual-exclusion
  // adjustment (which removes one field when only one test score is present)
  // is preserved rather than hard-coding a raw field count here.
  const mergedTotal = sorted[sorted.length - 1]?.fields_total ?? (MERGEABLE_FIELDS.length + 1);

  return {
    ...(merged as Partial<Recruit>),
    positions,
    extraction_confidence: mergedConfidence,
    fields_missing: mergedMissing,
    fields_extracted: mergedExtracted,
    fields_total: mergedTotal,
  };
}

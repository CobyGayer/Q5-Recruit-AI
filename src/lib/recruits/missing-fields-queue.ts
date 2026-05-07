import type { SupabaseClient } from "@supabase/supabase-js";
import { adjustCompletenessForWeights } from "@/lib/scoring/completeness";
import type { ClubLevel } from "@/types/database";

/**
 * Attempt to add a recruit to the missing-fields request queue.
 * Silently no-ops if:
 *   - Recruit already queued (upsert with ON CONFLICT DO NOTHING on recruit_id)
 *   - Recruit has no weight-adjusted missing fields
 *
 * Caller must pass an admin client — inserts bypass RLS.
 * @returns true if a new queue row was inserted
 */
export async function maybeQueueMissingFieldsRequest(
  db: SupabaseClient,
  recruitId: string,
  programId: string,
  coachId: string
): Promise<boolean> {
  const recruitPromise = db
    .from("recruits")
    .select("fields_missing, fields_extracted, fields_total, club_level")
    .eq("id", recruitId)
    .single();

  const programConfigQuery: any = db.from("program_config").select("*").eq("program_id", programId);
  const configPromise = typeof programConfigQuery.maybeSingle === "function"
    ? programConfigQuery.maybeSingle()
    : programConfigQuery.single();

  const [{ data: recruit }, configRes] = await Promise.all([recruitPromise, configPromise]);
  const config = configRes?.data ?? null;

  if (!recruit) return false;

  const adjusted = adjustCompletenessForWeights(
    (recruit.fields_missing as string[]) ?? [],
    (recruit.fields_extracted as number) ?? 0,
    (recruit.fields_total as number) ?? 0,
    config ?? null,
    (recruit.club_level as ClubLevel | null) ?? null
  );

  if (adjusted.missing.length === 0) return false;

  const { data: inserted, error } = await db
    .from("recruit_missing_fields_queue")
    .upsert(
      {
        recruit_id: recruitId,
        program_id: programId,
        coach_id: coachId,
        missing_fields_snapshot: adjusted.missing,
      },
      // ignoreDuplicates: one-time-ask rule — if recruit already queued, do nothing.
      // missing_fields_snapshot is intentionally stale after initial insert; effective_missing_fields
      // is live-computed in the GET response so email templates stay accurate.
      { onConflict: "recruit_id", ignoreDuplicates: true }
    )
    .select("id");

  if (error) {
    console.error("[missing-fields-queue] insert failed:", error.message);
    return false;
  }

  return Array.isArray(inserted) && inserted.length > 0;
}

/**
 * Bulk-scan all recruits in a program and queue missing-fields requests for
 * any that have weight-adjusted missing fields and aren't already queued.
 * Caller must pass an admin client — inserts bypass RLS.
 * @returns count of new queue rows inserted
 */
export async function bulkScanProgramForMissingFields(
  db: SupabaseClient,
  programId: string
): Promise<number> {
  const { data: recruits } = await db
    .from("recruits")
    .select("id, coach_id")
    .eq("program_id", programId);

  if (!recruits || recruits.length === 0) return 0;

  const results = await Promise.allSettled(
    recruits.map((recruit) =>
      maybeQueueMissingFieldsRequest(db, recruit.id, programId, recruit.coach_id)
    )
  );

  return results.filter(
    (r): r is PromiseFulfilledResult<boolean> => r.status === "fulfilled" && r.value
  ).length;
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { adjustCompletenessForWeights } from "@/lib/scoring/completeness";
import type { ClubLevel } from "@/types/database";

/**
 * Attempt to add a recruit to the missing-fields request queue.
 * Silently no-ops if:
 *   - Recruit already queued (UNIQUE constraint → ON CONFLICT DO NOTHING)
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
  const [{ data: recruit }, { data: config }] = await Promise.all([
    db
      .from("recruits")
      .select("fields_missing, fields_extracted, fields_total, club_level")
      .eq("id", recruitId)
      .single(),
    db.from("program_config").select("*").eq("program_id", programId).single(),
  ]);

  if (!recruit) return false;

  const adjusted = adjustCompletenessForWeights(
    (recruit.fields_missing as string[]) ?? [],
    (recruit.fields_extracted as number) ?? 0,
    (recruit.fields_total as number) ?? 0,
    config ?? null,
    (recruit.club_level as ClubLevel | null) ?? null
  );

  if (adjusted.missing.length === 0) return false;

  const { error } = await db.from("recruit_missing_fields_queue").insert({
    recruit_id: recruitId,
    program_id: programId,
    coach_id: coachId,
    missing_fields_snapshot: adjusted.missing,
  });

  // Unique constraint violation (code 23505) means recruit was already queued — that's fine.
  if (error && error.code !== "23505") {
    console.error("[missing-fields-queue] insert failed:", error.message);
    return false;
  }

  return !error;
}

/** Mark a queue entry as "email sent", removing it from the pending view. Idempotent. */
export async function markMissingFieldsRequested(
  db: SupabaseClient,
  queueId: string
): Promise<void> {
  await db
    .from("recruit_missing_fields_queue")
    .update({ info_requested_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", queueId)
    .is("info_requested_at", null);
}

/** Dismiss a queue entry without sending an email. */
export async function dismissMissingFieldsQueueEntry(
  db: SupabaseClient,
  queueId: string
): Promise<void> {
  await db
    .from("recruit_missing_fields_queue")
    .update({ dismissed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", queueId);
}

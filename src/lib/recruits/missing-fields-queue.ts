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

  const { data: inserted, error } = await db
    .from("recruit_missing_fields_queue")
    .upsert(
      {
        recruit_id: recruitId,
        program_id: programId,
        coach_id: coachId,
        missing_fields_snapshot: adjusted.missing,
      },
      { onConflict: "recruit_id", ignoreDuplicates: true }
    )
    .select("id");

  if (error) {
    console.error("[missing-fields-queue] insert failed:", error.message);
    return false;
  }

  return Array.isArray(inserted) && inserted.length > 0;
}

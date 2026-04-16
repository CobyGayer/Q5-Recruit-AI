import type { SupabaseClient } from "@supabase/supabase-js";
import type { DuplicateReviewGroupSource } from "@/types/database";
import { normalizeNameKey } from "./name-key";

/**
 * After a recruit is created or its name becomes newly available/changed,
 * check whether other recruits in the same program share the same
 * normalized name key. If so, materialise or refresh a pending review group.
 *
 * @param db         - Admin Supabase client (bypasses RLS)
 * @param programId  - The program to search within
 * @param recruitId  - The recruit that was just created/updated
 * @param prevNameKey - The recruit's name_key before this operation (null = just created)
 * @param newNameKey  - The recruit's name_key after this operation
 * @param source     - Whether this was triggered by ingestion or admin scan
 */
export async function checkAndQueueDuplicateReview(
  db: SupabaseClient,
  programId: string,
  recruitId: string,
  prevNameKey: string | null,
  newNameKey: string | null,
  source: DuplicateReviewGroupSource = "ingest"
): Promise<void> {
  // Only scan on create (prevNameKey null) or when the name actually changed/appeared.
  if (prevNameKey === newNameKey) return;

  // When the name changed (or was removed), remove this recruit from the old pending group.
  // If the old group drops below 2 members it is auto-resolved.
  if (prevNameKey) {
    await pruneFromOldGroup(db, programId, recruitId, prevNameKey);
  }

  // Name was removed — nothing left to queue.
  if (!newNameKey) return;

  // Find other recruits in the same program with the same name_key.
  const { data: matches } = await db
    .from("recruits")
    .select("id")
    .eq("program_id", programId)
    .eq("name_key", newNameKey)
    .neq("id", recruitId);

  if (!matches || matches.length === 0) return; // no duplicates found

  await upsertReviewGroup(db, programId, newNameKey, [recruitId, ...matches.map((r) => r.id)], source);
}

/**
 * Remove a recruit from the pending review group for the given name_key.
 * If the group drops below 2 members, auto-resolve it.
 */
async function pruneFromOldGroup(
  db: SupabaseClient,
  programId: string,
  recruitId: string,
  nameKey: string
): Promise<void> {
  const { data: group } = await db
    .from("recruit_duplicate_review_groups")
    .select("id")
    .eq("program_id", programId)
    .eq("name_key", nameKey)
    .eq("status", "pending")
    .maybeSingle();

  if (!group) return;

  // Remove this recruit from the group.
  await db
    .from("recruit_duplicate_review_group_members")
    .delete()
    .eq("group_id", group.id)
    .eq("recruit_id", recruitId);

  // Count remaining members.
  const { count } = await db
    .from("recruit_duplicate_review_group_members")
    .select("*", { count: "exact", head: true })
    .eq("group_id", group.id);

  if ((count ?? 0) < 2) {
    await db
      .from("recruit_duplicate_review_groups")
      .update({ status: "resolved", resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", group.id);
  }
}

/**
 * Bulk-scan all recruits for a program and queue review groups for every
 * same-name cluster with 2+ members. Used by the admin backfill trigger.
 */
export async function bulkScanProgramForDuplicates(
  db: SupabaseClient,
  programId: string
): Promise<number> {
  const { data: recruits } = await db
    .from("recruits")
    .select("id, name_key")
    .eq("program_id", programId)
    .not("name_key", "is", null);

  if (!recruits || recruits.length === 0) return 0;

  // Group by name_key
  const byNameKey = new Map<string, string[]>();
  for (const r of recruits) {
    if (!r.name_key) continue;
    const bucket = byNameKey.get(r.name_key) ?? [];
    bucket.push(r.id);
    byNameKey.set(r.name_key, bucket);
  }

  let groupsQueued = 0;
  for (const [nameKey, ids] of byNameKey.entries()) {
    if (ids.length < 2) continue;
    await upsertReviewGroup(db, programId, nameKey, ids, "admin_scan");
    groupsQueued++;
  }

  return groupsQueued;
}

/**
 * Materialise or refresh a pending review group for a given (program, name_key).
 *
 * Uses an explicit SELECT → INSERT-or-UPDATE instead of a PostgREST upsert with
 * onConflict so we do not depend on PostgREST's partial-index conflict resolution,
 * which is version-sensitive and may silently fall back to DO NOTHING.
 *
 * Members are added idempotently via INSERT ... ON CONFLICT DO NOTHING.
 */
async function upsertReviewGroup(
  db: SupabaseClient,
  programId: string,
  nameKey: string,
  recruitIds: string[],
  source: DuplicateReviewGroupSource
): Promise<void> {
  // Check for an existing pending group first.
  const { data: existing } = await db
    .from("recruit_duplicate_review_groups")
    .select("id")
    .eq("program_id", programId)
    .eq("name_key", nameKey)
    .eq("status", "pending")
    .maybeSingle();

  let group: { id: string } | null = null;

  if (existing) {
    // Refresh the updated_at timestamp so coaches know this group was recently touched.
    await db
      .from("recruit_duplicate_review_groups")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    group = existing;
  } else {
    // Insert a fresh pending group.
    const { data: inserted, error: insertError } = await db
      .from("recruit_duplicate_review_groups")
      .insert({
        program_id: programId,
        name_key: nameKey,
        status: "pending",
        source,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      // Unique constraint violation: another concurrent request won the race.
      // Re-query for the group it created so we can still add members.
      const { data: raceWinner } = await db
        .from("recruit_duplicate_review_groups")
        .select("id")
        .eq("program_id", programId)
        .eq("name_key", nameKey)
        .eq("status", "pending")
        .maybeSingle();

      if (!raceWinner) {
        throw new Error(`[duplicate-review] Failed to insert review group and could not find existing: ${insertError?.message}`);
      }
      group = raceWinner;
    } else {
      group = inserted;
    }
  }

  if (!group) {
    console.error("[duplicate-review] No group available after upsert logic");
    return;
  }

  // Add all recruits as members, ignoring any that are already present.
  const memberRows = recruitIds.map((id) => ({
    group_id: group.id,
    recruit_id: id,
  }));

  const { error: memberError } = await db
    .from("recruit_duplicate_review_group_members")
    .upsert(memberRows, { onConflict: "group_id,recruit_id", ignoreDuplicates: true });

  if (memberError) {
    console.error("[duplicate-review] Failed to insert group members:", memberError.message);
  }
}

// Re-export for convenience
export { normalizeNameKey };

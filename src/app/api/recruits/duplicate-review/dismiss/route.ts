import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveProgramContext } from "@/lib/program-context";
import { maybeQueueMissingFieldsRequest } from "@/lib/recruits/missing-fields-queue";

/**
 * POST /api/recruits/duplicate-review/dismiss
 *
 * Marks a pending duplicate review group as dismissed without merging anything.
 * The coach will stop being prompted about this name cluster until a later
 * ingest touches one of those recruits or the admin backfill is re-run.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getEffectiveProgramContext(supabase, user.id);
  if (!ctx) {
    return NextResponse.json({ error: "No program context" }, { status: 400 });
  }

  const { effectiveProgramId, db } = ctx;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const groupId = body.group_id as string | undefined;
  if (!groupId) {
    return NextResponse.json({ error: "group_id is required" }, { status: 400 });
  }

  // Verify group belongs to this program before updating
  const { data: group } = await db
    .from("recruit_duplicate_review_groups")
    .select("id, status")
    .eq("id", groupId)
    .eq("program_id", effectiveProgramId)
    .single();

  if (!group) {
    return NextResponse.json({ error: "Review group not found" }, { status: 404 });
  }

  if (group.status !== "pending") {
    return NextResponse.json({ error: "Group is not pending" }, { status: 400 });
  }

  const { error } = await db
    .from("recruit_duplicate_review_groups")
    .update({
      status: "dismissed",
      dismissed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", groupId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // After dismissing the name-match group, add each member to the missing-fields
  // queue if they have outstanding fields (coach decided these are new recruits).
  const { data: members } = await db
    .from("recruit_duplicate_review_group_members")
    .select("recruit_id")
    .eq("group_id", groupId);

  if (members && members.length > 0) {
    const adminDb = createAdminClient();
    await Promise.allSettled(
      members.map((m) =>
        maybeQueueMissingFieldsRequest(adminDb, m.recruit_id, effectiveProgramId, user.id)
      )
    );
  }

  return NextResponse.json({ success: true });
}

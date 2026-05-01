import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveProgramContext } from "@/lib/program-context";

/**
 * POST /api/recruits/missing-fields-queue/dismiss
 *
 * Dismisses a single queue entry without sending an email.
 * The recruit remains in the system but leaves the pending view.
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

  const queueId = body.queue_id as string | undefined;
  if (!queueId) {
    return NextResponse.json({ error: "queue_id is required" }, { status: 400 });
  }

  const { data: entry } = await db
    .from("recruit_missing_fields_queue")
    .select("id, info_requested_at")
    .eq("id", queueId)
    .eq("program_id", effectiveProgramId)
    .single();

  if (!entry) {
    return NextResponse.json({ error: "Queue entry not found" }, { status: 404 });
  }

  if (entry.info_requested_at) {
    return NextResponse.json({ error: "Entry already marked as requested" }, { status: 409 });
  }

  const { error } = await db
    .from("recruit_missing_fields_queue")
    .update({
      dismissed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", queueId)
    .is("info_requested_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

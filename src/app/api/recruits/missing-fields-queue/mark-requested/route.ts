import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveProgramContext } from "@/lib/program-context";

/**
 * POST /api/recruits/missing-fields-queue/mark-requested
 *
 * Marks a queue entry as "info requested", removing it from the pending view.
 * Idempotent: repeated calls after info_requested_at is already set are no-ops.
 * Optionally writes an audit row to email_log if subject/body/method are provided.
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

  // Verify ownership and fetch recruit_id for email log
  const { data: entry } = await db
    .from("recruit_missing_fields_queue")
    .select("id, recruit_id, info_requested_at, dismissed_at")
    .eq("id", queueId)
    .eq("program_id", effectiveProgramId)
    .eq("coach_id", user.id)
    .single();

  if (!entry) {
    return NextResponse.json({ error: "Queue entry not found" }, { status: 404 });
  }

  if (entry.dismissed_at) {
    return NextResponse.json({ error: "Entry already dismissed" }, { status: 409 });
  }

  // Mark as requested (idempotent — DB filter ensures no double-write under race)
  if (!entry.info_requested_at) {
    const { error: updateError } = await db
      .from("recruit_missing_fields_queue")
      .update({
        info_requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", queueId)
      .is("info_requested_at", null);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  // Write to email_log for audit trail if email content provided
  const emailSubject = body.subject as string | undefined;
  const emailBody = body.body as string | undefined;
  const emailMethod = body.method as string | undefined;

  if (emailSubject && emailBody && emailMethod) {
    const { error: logError } = await db.from("email_log").insert({
      coach_id: user.id,
      recruit_id: entry.recruit_id,
      subject: emailSubject,
      body: emailBody,
      method: emailMethod,
    });

    if (logError) {
      return NextResponse.json({ error: logError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}

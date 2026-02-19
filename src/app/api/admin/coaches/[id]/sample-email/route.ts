import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildSampleEmailPayload } from "@/lib/sample-email";
import { Resend } from "resend";
import type { ProgramConfig } from "@/types/database";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: coachId } = await params;

  // Auth: session + admin role check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: admin } = await supabase
    .from("coaches")
    .select("role")
    .eq("id", user.id)
    .single();

  if (admin?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminSupabase = createAdminClient();

  // Verify target coach exists, is approved, and get their email
  const { data: coach, error: coachError } = await adminSupabase
    .from("coaches")
    .select("id, status, email")
    .eq("id", coachId)
    .single();

  if (coachError || !coach) {
    return NextResponse.json({ error: "Coach not found" }, { status: 404 });
  }

  if (coach.status !== "approved") {
    return NextResponse.json(
      { error: "Coach must be approved before sending sample" },
      { status: 400 }
    );
  }

  if (!coach.email) {
    return NextResponse.json(
      { error: "Coach has no email address on file" },
      { status: 400 }
    );
  }

  // Fetch config so we can tailor the sample to the coach's thresholds
  const { data: config } = await adminSupabase
    .from("program_config")
    .select("*")
    .eq("coach_id", coachId)
    .single();

  const payload = buildSampleEmailPayload(config as ProgramConfig | null);

  // Send the sample email via Resend
  try {
    await resend.emails.send({
      from: "Q5 Recruit AI <onboarding@resend.dev>",
      to: coach.email,
      subject: payload.subject,
      text: payload.body_plain,
    });

    return NextResponse.json({
      success: true,
      message: `Sample email sent to ${coach.email}`,
    });
  } catch (error) {
    console.error("Failed to send sample email:", error);
    return NextResponse.json(
      { error: "Failed to send sample email", details: String(error) },
      { status: 500 }
    );
  }
}

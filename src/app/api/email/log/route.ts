import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const recruitIds = Array.isArray(body.recruitIds)
    ? body.recruitIds
    : typeof body.recruitId === "string"
    ? [body.recruitId]
    : [];
  const subject = typeof body.subject === "string" ? body.subject : "";
  const emailBody = typeof body.body === "string" ? body.body : "";
  const method = typeof body.method === "string" ? body.method : "";

  if (recruitIds.length === 0 || !subject || !emailBody || !method) {
    return NextResponse.json(
      { error: "recruitId(s), subject, body, and method are required" },
      { status: 400 }
    );
  }

  if (!["gmail", "outlook", "mailto", "clipboard"].includes(method)) {
    return NextResponse.json(
      { error: "method must be gmail, outlook, mailto, or clipboard" },
      { status: 400 }
    );
  }

  // Insert one log entry per recruit
  const rows = recruitIds.map((recruitId: string) => ({
    coach_id: user.id,
    recruit_id: recruitId,
    subject,
    body: emailBody,
    method,
  }));

  const { error } = await supabase.from("email_log").insert(rows);

  if (error) {
    console.error("Failed to log email:", error);
    return NextResponse.json(
      { error: "Failed to log email" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

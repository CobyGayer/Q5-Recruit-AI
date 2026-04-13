import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminProgramOverride } from "@/lib/admin-cookies";
import { generateAnnouncementDraft } from "@/lib/email/draft";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const recruitIds = Array.isArray(body.recruitIds) ? body.recruitIds : [];
  const purpose = typeof body.purpose === "string" ? body.purpose.trim() : "";

  if (recruitIds.length === 0) {
    return NextResponse.json({ error: "recruitIds array is required" }, { status: 400 });
  }
  if (!purpose) {
    return NextResponse.json(
      { error: "purpose is required (e.g., 'camp invite', 'questionnaire')" },
      { status: 400 }
    );
  }

  const { data: coach } = await supabase
    .from("coaches")
    .select("full_name, program_id, role")
    .eq("id", user.id)
    .single();

  const overrideProgramId = await getAdminProgramOverride(coach?.role ?? "coach");
  const effectiveProgramId = overrideProgramId ?? coach?.program_id;
  const db = overrideProgramId ? createAdminClient() : supabase;

  // Scope recruit fetch to the effective program to prevent cross-workspace lookups
  let recruitsQuery = db.from("recruits").select("id, email").in("id", recruitIds);
  if (overrideProgramId) recruitsQuery = recruitsQuery.eq("program_id", overrideProgramId);
  const { data: recruits } = await recruitsQuery;

  if (!recruits?.length) {
    return NextResponse.json({ error: "No recruits found" }, { status: 404 });
  }

  const bccEmails = recruits.map((r) => r.email).filter((e): e is string => !!e);

  if (bccEmails.length === 0) {
    return NextResponse.json(
      { error: "None of the selected recruits have email addresses" },
      { status: 400 }
    );
  }

  let programName = "";
  let institution = "";
  if (effectiveProgramId) {
    const { data: program } = await db
      .from("programs")
      .select("name, institution")
      .eq("id", effectiveProgramId)
      .single();
    programName = program?.name ?? "";
    institution = program?.institution ?? "";
  }

  try {
    const draft = await generateAnnouncementDraft(
      coach?.full_name ?? "Coach",
      programName,
      institution,
      purpose,
      bccEmails.length
    );

    return NextResponse.json({ ...draft, bccEmails });
  } catch (error) {
    console.error("Failed to generate announcement draft:", error);
    return NextResponse.json({ error: "Failed to generate announcement draft" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveProgramContext } from "@/lib/program-context";
import { adjustCompletenessForWeights } from "@/lib/scoring/completeness";
import { buildMissingFieldsRequestTemplate } from "@/lib/email/draft";
import type { ClubLevel } from "@/types/database";

/**
 * GET /api/recruits/missing-fields-queue
 *
 * Returns pending missing-fields queue entries for the current program.
 * ?count_only=true → fast count for dashboard banner.
 * Full response includes weight-adjusted missing fields and pre-filled email template.
 */
export async function GET(request: NextRequest) {
  try {
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

  // Fast path: dashboard banner only needs a count
  const countOnly = request.nextUrl.searchParams.get("count_only") === "true";
  if (countOnly) {
    const { count, error } = await db
      .from("recruit_missing_fields_queue")
      .select("id", { count: "exact", head: true })
      .eq("program_id", effectiveProgramId)
      .eq("coach_id", user.id)
      .is("info_requested_at", null)
      .is("dismissed_at", null);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ count: count ?? 0 });
  }

  // Fetch queue rows
  const { data: queueRows, error: queueError } = await db
    .from("recruit_missing_fields_queue")
    .select("id, recruit_id, queued_at, missing_fields_snapshot")
    .eq("program_id", effectiveProgramId)
    .eq("coach_id", user.id)
    .is("info_requested_at", null)
    .is("dismissed_at", null)
    .order("queued_at", { ascending: true });

  if (queueError) {
    return NextResponse.json({ error: queueError.message }, { status: 500 });
  }

  if (!queueRows || queueRows.length === 0) {
    return NextResponse.json([]);
  }

  const recruitIds = queueRows.map((r) => r.recruit_id);

  // Fetch recruits, config, coach, and program in parallel
  const [
    { data: recruits },
    { data: config },
    { data: coach },
    { data: program },
  ] = await Promise.all([
    db
      .from("recruits")
      .select(
        "id, full_name, email, graduation_year, positions, current_school, club_team, gpa, fields_missing, fields_extracted, fields_total, club_level"
      )
      .in("id", recruitIds),
    db.from("program_config").select("*").eq("program_id", effectiveProgramId).single(),
    db
      .from("coaches")
      .select("full_name, program_id")
      .eq("id", user.id)
      .single(),
    db
      .from("programs")
      .select("name, institution")
      .eq("id", effectiveProgramId)
      .single(),
  ]);

  const recruitMap = new Map((recruits ?? []).map((r) => [r.id, r]));

  const coachName = (coach?.full_name as string | null) ?? "Coach";
  const programName = (program?.name as string | null) ?? "";
  const institution = (program?.institution as string | null) ?? "";

  const result = [];

  for (const row of queueRows) {
    const recruit = recruitMap.get(row.recruit_id);
    if (!recruit) continue;

    const adjusted = adjustCompletenessForWeights(
      (recruit.fields_missing as string[]) ?? [],
      (recruit.fields_extracted as number) ?? 0,
      (recruit.fields_total as number) ?? 0,
      config ?? null,
      (recruit.club_level as ClubLevel | null) ?? null
    );

    // Skip recruits where all missing fields are excluded by current weights
    if (adjusted.missing.length === 0) continue;

    const firstName = recruit.full_name
      ? (recruit.full_name as string).trim().split(/\s+/)[0]
      : null;

    const { subject, body } = buildMissingFieldsRequestTemplate({
      recruitFirstName: firstName,
      coachName,
      programName,
      institution,
      missingFields: adjusted.missing,
    });

    result.push({
      id: row.id,
      recruit_id: row.recruit_id,
      queued_at: row.queued_at,
      missing_fields_snapshot: row.missing_fields_snapshot,
      recruit: {
        id: recruit.id,
        full_name: recruit.full_name ?? null,
        email: recruit.email ?? null,
        graduation_year: recruit.graduation_year ?? null,
        positions: (recruit.positions as string[]) ?? [],
        current_school: recruit.current_school ?? null,
        club_team: recruit.club_team ?? null,
        gpa: recruit.gpa ?? null,
        fields_missing: (recruit.fields_missing as string[]) ?? [],
        fields_extracted: (recruit.fields_extracted as number) ?? 0,
        fields_total: (recruit.fields_total as number) ?? 0,
        club_level: recruit.club_level ?? null,
      },
      effective_missing_fields: adjusted.missing,
      pre_filled_subject: subject,
      pre_filled_body: body,
    });
  }

  return NextResponse.json(result);
  } catch (err) {
    console.error("[missing-fields-queue GET]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminProgramOverride } from "@/lib/admin-cookies";
import { z } from "zod";
import { normalizeEmail } from "@/lib/utils/email";
import { checkAndQueueDuplicateReview } from "@/lib/recruits/duplicate-review";
import { computeCompletenessMetadata } from "@/lib/recruits/completeness-metadata";
import { calculateDQS } from "@/lib/scoring/dqs";
import type { ConfidenceLevel } from "@/types/database";
import type { ProgramConfig, Recruit, TranscriptAnalysis } from "@/types/database";
import { shouldMarkOutsideSelection } from "@/lib/data/league-preferences";

const ClubLevelUpdateSchema = z.preprocess((value) => {
  if (value === null || value === "") return "unknown";
  return value;
}, z.enum(["mls_next", "ecnl", "ecrl", "ga", "ga_aspire", "regional", "other", "unknown"]));

const VALID_POSITIONS = ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST", "CF"] as const;

const RecruitUpdateSchema = z.object({
  full_name: z.string().nullable().optional(),
  email: z.string().nullable().optional().refine((v) => v == null || z.string().email().safeParse(v).success, { message: "Invalid email" }),
  phone: z.string().nullable().optional(),
  graduation_year: z.number().int().min(2015).max(2035).nullable().optional(),
  current_school: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  positions: z.array(z.enum(VALID_POSITIONS)).optional(),
  preferred_foot: z.string().nullable().optional(),
  height_inches: z.number().int().min(48).max(96).nullable().optional(),
  weight_lbs: z.number().int().min(80).max(350).nullable().optional(),
  gpa: z.number().min(0).max(5).nullable().optional(),
  sat_score: z.number().int().min(400).max(1600).nullable().optional(),
  act_score: z.number().int().min(1).max(36).nullable().optional(),
  club_team: z.string().nullable().optional(),
  club_level: ClubLevelUpdateSchema.optional(),
  high_school_team: z.string().nullable().optional(),
  video_url: z.string().url().nullable().optional(),
}).strict();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: coach } = await supabase
    .from("coaches")
    .select("role")
    .eq("id", user.id)
    .single();

  const overrideProgramId = await getAdminProgramOverride(coach?.role ?? "coach");
  const db = overrideProgramId ? createAdminClient() : supabase;

  // When override is active, scope the recruit query to the overridden program so
  // the admin cannot reach records outside the currently selected workspace.
  let recruitQuery = db.from("recruits").select("*").eq("id", id);
  if (overrideProgramId) recruitQuery = recruitQuery.eq("program_id", overrideProgramId);

  const [recruitResult, scoreResult, flagResult, emailsResult, transcriptResult] =
    await Promise.all([
      recruitQuery.single(),
      db.from("recruit_dqs_scores").select("*").eq("recruit_id", id).maybeSingle(),
      db.from("coach_recruit_flags").select("*").eq("recruit_id", id).maybeSingle(),
      db.from("ingested_emails")
        .select("id, subject, sender_email, sender_name, body_plain, received_at, created_at")
        .eq("recruit_id", id)
        .order("received_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true }),
      db.from("transcript_analyses").select("*").eq("recruit_id", id).maybeSingle(),
    ]);

  if (recruitResult.error || !recruitResult.data) {
    return NextResponse.json({ error: "Recruit not found" }, { status: 404 });
  }

  const emails = emailsResult.data ?? [];

  return NextResponse.json({
    recruit: recruitResult.data,
    dqs_score: scoreResult.data ?? null,
    flag: flagResult.data ?? null,
    source_emails: emails,
    transcript_analysis: transcriptResult.data ?? null,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: coach } = await supabase
    .from("coaches")
    .select("role")
    .eq("id", user.id)
    .single();

  const raw = await request.json();
  const parsed = RecruitUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const overrideProgramId = await getAdminProgramOverride(coach?.role ?? "coach");
  const db = overrideProgramId ? createAdminClient() : supabase;

  // Fetch pre-update state: name_key (for duplicate-review diff) and
  // extraction_confidence (to merge with manual-edit confidence patch).
  let preFetchQuery = db
    .from("recruits")
    .select("name_key, extraction_confidence")
    .eq("id", id);
  if (overrideProgramId) preFetchQuery = preFetchQuery.eq("program_id", overrideProgramId);
  const { data: current } = await preFetchQuery.single();
  const prevNameKey: string | null = current?.name_key ?? null;
  const prevConfidence: Record<string, ConfidenceLevel> = (current?.extraction_confidence ?? {}) as Record<string, ConfidenceLevel>;

  // Stamp manually-edited non-null fields with "high" confidence so they survive
  // future duplicate merges. merge-payload prefers higher confidence; a field
  // with no confidence entry would be overwritten by any extracted value.
  const manualConfidencePatch: Record<string, ConfidenceLevel> = {};
  const clearedFields: string[] = [];
  for (const [field, value] of Object.entries(parsed.data)) {
    const isUnknownClubLevel = field === "club_level" && value === "unknown";
    if (value != null && !isUnknownClubLevel) {
      manualConfidencePatch[field] = "high";
    } else if (value == null && !isUnknownClubLevel) {
      // Track fields that are being cleared (set to null)
      clearedFields.push(field);
    }
  }
  const updatedConfidence = { ...prevConfidence, ...manualConfidencePatch };

  // Remove confidence entries for fields that were explicitly cleared
  for (const field of clearedFields) {
    delete updatedConfidence[field];
  }

  // A manual clear maps club_level to "unknown". Keep storage non-nullable,
  // but ensure the clear does not remain an authoritative high-confidence value.
  const clearedClubLevelToUnknown = parsed.data.club_level === "unknown";
  if (clearedClubLevelToUnknown) {
    delete updatedConfidence.club_level;
  }

  const shouldPersistConfidence =
    Object.keys(manualConfidencePatch).length > 0 ||
    clearedFields.length > 0 ||
    (clearedClubLevelToUnknown && Object.hasOwn(prevConfidence, "club_level"));

  const updateData = {
    ...parsed.data,
    ...(parsed.data.email !== undefined && { email: normalizeEmail(parsed.data.email) }),
    ...(shouldPersistConfidence && { extraction_confidence: updatedConfidence }),
  };

  // Check if there are any actual changes to persist
  const hasChanges = Object.keys(updateData).length > 0;

  let persistedRecruit: any;

  if (!hasChanges) {
    // No changes to persist; fetch and return current recruit without updating
    let fetchQuery = db.from("recruits").select("*").eq("id", id);
    if (overrideProgramId) {
      fetchQuery = fetchQuery.eq("program_id", overrideProgramId);
    }
    const { data: currentRecruit, error: fetchError } = await fetchQuery.single();
    
    if (fetchError || !currentRecruit) {
      return NextResponse.json({ error: "Recruit not found" }, { status: 404 });
    }
    
    persistedRecruit = currentRecruit;
  } else {
    // When override is active, scope the update to the overridden program_id to
    // prevent cross-program writes if the recruit ID somehow belongs elsewhere.
    let query = db.from("recruits").update(updateData).eq("id", id);
    if (overrideProgramId) {
      query = query.eq("program_id", overrideProgramId);
    }
    const { data, error } = await query.select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    persistedRecruit = data;
  }
  const completeness = computeCompletenessMetadata(
    (persistedRecruit ?? {}) as Record<string, unknown>
  );
  const needsCompletenessRefresh =
    JSON.stringify(persistedRecruit?.fields_missing ?? []) !==
      JSON.stringify(completeness.fields_missing) ||
    persistedRecruit?.fields_extracted !== completeness.fields_extracted ||
    persistedRecruit?.fields_total !== completeness.fields_total;

  if (needsCompletenessRefresh) {
    let completenessQuery = db
      .from("recruits")
      .update(completeness)
      .eq("id", id);
    if (overrideProgramId) {
      completenessQuery = completenessQuery.eq("program_id", overrideProgramId);
    }

    const { data: refreshedRecruit, error: completenessError } =
      await completenessQuery.select().single();

    if (completenessError) {
      return NextResponse.json(
        { error: completenessError.message },
        { status: 500 }
      );
    }

    persistedRecruit = refreshedRecruit;
  }

  // Only trigger duplicate-review when full_name is explicitly being changed.
  // Do not resurface dismissed groups on unrelated field edits — the UI always
  // sends full_name in the payload, so we guard by comparing the actual name_key.
  const newNameKey = (persistedRecruit?.name_key as string | null) ?? null;
  if (parsed.data.full_name !== undefined && persistedRecruit && prevNameKey !== newNameKey) {
    const adminDb = createAdminClient();
    const duplicateSource = overrideProgramId ? "admin_scan" : "ingest";
    checkAndQueueDuplicateReview(
      adminDb,
      persistedRecruit.program_id,
      id,
      prevNameKey,
      newNameKey,
      duplicateSource
    ).catch((err) => console.error("[recruits/PUT] duplicate-review queue failed:", err));
  }

  const [configResult, transcriptResult, programResult] = await Promise.all([
    db
      .from("program_config")
      .select("*")
      .eq("program_id", persistedRecruit.program_id)
      .maybeSingle(),
    db
      .from("transcript_analyses")
      .select("*")
      .eq("recruit_id", id)
      .maybeSingle(),
    db
      .from("programs")
      .select("is_boys_team")
      .eq("id", persistedRecruit.program_id)
      .maybeSingle(),
  ]);

  if (configResult.data) {
    const isBoys = programResult.data?.is_boys_team ?? true;
    const dqsResult = calculateDQS(
      persistedRecruit as Recruit,
      configResult.data as ProgramConfig,
      (transcriptResult.data as TranscriptAnalysis | null) ?? null,
      isBoys
    );

    const { error: dqsError } = await db.from("recruit_dqs_scores").upsert(
      {
        recruit_id: id,
        coach_id: user.id,
        program_id: persistedRecruit.program_id,
        overall_score: dqsResult.score,
        is_qualified: dqsResult.isQualified,
        disqualification_reasons: dqsResult.disqualificationReasons,
        academic_score: dqsResult.componentScores.academic,
        competition_score: dqsResult.componentScores.competition,
        physical_score: dqsResult.componentScores.physical,
        position_fit_score: dqsResult.componentScores.positionFit,
        grad_year_score: dqsResult.componentScores.gradYear,
        completeness_score: dqsResult.componentScores.completeness,
        bonus_points: dqsResult.bonusPoints,
        completeness_penalty: dqsResult.completenessPenalty,
        score_breakdown: dqsResult.breakdown,
        calculated_at: new Date().toISOString(),
      },
      { onConflict: "recruit_id" }
    );

    if (dqsError) {
      return NextResponse.json({ error: dqsError.message }, { status: 500 });
    }

    // Update is_outside_selected_leagues flag based on league preferences.
    if (configResult.data) {
      const leaguePreferences = (configResult.data as ProgramConfig).league_preferences || [];
      const isOutside = shouldMarkOutsideSelection(persistedRecruit.club_level, leaguePreferences);

      if (persistedRecruit.is_outside_selected_leagues !== isOutside) {
        let flagUpdateQuery = db
          .from("recruits")
          .update({ is_outside_selected_leagues: isOutside })
          .eq("id", id);
        if (overrideProgramId) {
          flagUpdateQuery = flagUpdateQuery.eq("program_id", overrideProgramId);
        }

        const { data: updatedWithFlag, error: flagError } = await flagUpdateQuery.select().single();

        if (!flagError && updatedWithFlag) {
          persistedRecruit = updatedWithFlag;
        }
      }
    }
  }

  return NextResponse.json(persistedRecruit);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: coach } = await supabase
    .from("coaches")
    .select("role")
    .eq("id", user.id)
    .single();

  const overrideProgramId = await getAdminProgramOverride(coach?.role ?? "coach");
  const db = overrideProgramId ? createAdminClient() : supabase;

  let query = db.from("recruits").delete().eq("id", id);
  if (overrideProgramId) {
    query = query.eq("program_id", overrideProgramId);
  }
  const { error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

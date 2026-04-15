import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveProgramContext } from "@/lib/program-context";
import type { RecruitWithScore } from "@/types/database";
import { generateExcel } from "@/lib/export/excel";
import { generateCSV } from "@/lib/export/csv";

export interface ExportRequest {
  format: "excel" | "csv";
  selectedColumns?: Record<string, boolean>;
  recruitIds?: string[];
}

export async function POST(request: NextRequest) {
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
      return NextResponse.json({ error: "Coach program not set" }, { status: 400 });
    }
    const { effectiveProgramId, db } = ctx;

    const body: ExportRequest = await request.json();

    if (!body.format || !["excel", "csv"].includes(body.format)) {
      return NextResponse.json({ error: "Invalid format" }, { status: 400 });
    }

    const { data: coach, error: coachError } = await supabase
      .from("coaches")
      .select("program_id")
      .eq("id", user.id)
      .single();

    if (coachError || !coach?.program_id) {
      return NextResponse.json(
        { error: "Coach program not set" },
        { status: 400 }
      );
    }

    const EXPORT_LIMIT = 5000;
    const selectedIds = body.recruitIds && body.recruitIds.length > 0 ? body.recruitIds : null;

    let query = db
      .from("recruits")
      .select("*")
      .eq("program_id", effectiveProgramId)
      .order("full_name", { ascending: true })
      .limit(EXPORT_LIMIT + 1);
    if (selectedIds) {
      query = query.in("id", selectedIds);
    }
    const { data: recruits, error: recruitsError } = await query;

    if (recruitsError) {
      console.error("Error fetching recruits:", recruitsError);
      return NextResponse.json({ error: "Failed to fetch recruits" }, { status: 500 });
    }

    if (!recruits || recruits.length === 0) {
      return NextResponse.json({ error: "No recruits found to export" }, { status: 404 });
    }

    if (recruits.length > EXPORT_LIMIT) {
      return NextResponse.json(
        { error: `Export is limited to ${EXPORT_LIMIT} recruits. Please contact support for larger exports.` },
        { status: 400 }
      );
    }

    const recruitIds = recruits.map((r) => r.id);

    const [scoresResult, flagsResult] = await Promise.all([
      db.from("recruit_dqs_scores").select("*").in("recruit_id", recruitIds),
      db.from("coach_recruit_flags").select("*").eq("program_id", effectiveProgramId).in("recruit_id", recruitIds),
    ]);

    if (scoresResult.error) {
      console.error("Error fetching DQS scores:", scoresResult.error);
      return NextResponse.json({ error: "Failed to fetch DQS scores" }, { status: 500 });
    }
    if (flagsResult.error) {
      console.error("Error fetching flags:", flagsResult.error);
      return NextResponse.json({ error: "Failed to fetch flags" }, { status: 500 });
    }

    const dqsMap = new Map((scoresResult.data ?? []).map((d) => [d.recruit_id, d]));
    const flagsMap = new Map((flagsResult.data ?? []).map((f) => [f.recruit_id, f]));

    const recruitsWithScores: RecruitWithScore[] = recruits.map((recruit) => ({
      ...recruit,
      dqs_score: dqsMap.get(recruit.id) ?? null,
      flag: flagsMap.get(recruit.id) ?? null,
    }));

    if (body.format === "excel") {
      const buffer = await generateExcel(recruitsWithScores, {
        includeScores: true,
        includeConfidence: true,
        includeContactInfo: true,
        includeSummarySheet: true,
        selectedColumns: body.selectedColumns,
      });

      const filename = `recruits_${new Date().toISOString().split("T")[0]}.xlsx`;

      return new NextResponse(buffer as unknown as BodyInit, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    } else {
      const csvContent = generateCSV(recruitsWithScores, {
        includeScores: true,
        includeConfidence: true,
        includeContactInfo: true,
        selectedColumns: body.selectedColumns,
      });

      const filename = `recruits_${new Date().toISOString().split("T")[0]}.csv`;

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv;charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Failed to generate export" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { RecruitWithScore } from "@/types/database";
import { generateExcel } from "@/lib/export/excel";
import { generateCSV } from "@/lib/export/csv";

export interface ExportRequest {
  format: "excel" | "csv";
  selectedColumns?: Record<string, boolean>;
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

    const body: ExportRequest = await request.json();

    if (!body.format || !["excel", "csv"].includes(body.format)) {
      return NextResponse.json({ error: "Invalid format" }, { status: 400 });
    }

    // Fetch all recruits for this coach
    const { data: recruits, error: recruitsError } = await supabase
      .from("recruits")
      .select("*")
      .eq("coach_id", user.id)
      .order("full_name", { ascending: true });

    if (recruitsError) {
      console.error("Error fetching recruits:", recruitsError);
      return NextResponse.json(
        { error: "Failed to fetch recruits" },
        { status: 500 }
      );
    }

    if (!recruits || recruits.length === 0) {
      return NextResponse.json(
        { error: "No recruits found to export" },
        { status: 404 }
      );
    }

    // Fetch DQS scores for all recruits
    const recruitIds = recruits.map((r) => r.id);
    const { data: dqsScores, error: dqsError } = await supabase
      .from("recruit_dqs_scores")
      .select("*")
      .in("recruit_id", recruitIds);

    if (dqsError) {
      console.error("Error fetching DQS scores:", dqsError);
      return NextResponse.json(
        { error: "Failed to fetch DQS scores" },
        { status: 500 }
      );
    }

    // Fetch flags for all recruits
    const { data: flags, error: flagsError } = await supabase
      .from("coach_recruit_flags")
      .select("*")
      .eq("coach_id", user.id)
      .in("recruit_id", recruitIds);

    if (flagsError) {
      console.error("Error fetching flags:", flagsError);
      return NextResponse.json(
        { error: "Failed to fetch flags" },
        { status: 500 }
      );
    }

    // Create DQS lookup map
    const dqsMap = new Map(dqsScores?.map((d) => [d.recruit_id, d]) ?? []);

    // Create flags lookup map
    const flagsMap = new Map(flags?.map((f) => [f.recruit_id, f]) ?? []);

    // Combine into RecruitWithScore array
    const recruitsWithScores: RecruitWithScore[] = recruits.map((recruit) => ({
      ...recruit,
      dqs_score: dqsMap.get(recruit.id) ?? null,
      flag: flagsMap.get(recruit.id) ?? null,
    }));

    // Generate file based on format
    if (body.format === "excel") {
      const buffer = await generateExcel(recruitsWithScores, {
        includeScores: true,
        includeConfidence: true,
        includeContactInfo: true,
        includeSummarySheet: true,
        selectedColumns: body.selectedColumns,
      });

      const filename = `recruits_${new Date().toISOString().split("T")[0]}.xlsx`;

      // exceljs writeBuffer() returns Buffer | Uint8Array; cast needed for NextResponse compat
      return new NextResponse(buffer as unknown as BodyInit, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    } else {
      // CSV format
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
    return NextResponse.json(
      { error: "Failed to generate export" },
      { status: 500 }
    );
  }
}

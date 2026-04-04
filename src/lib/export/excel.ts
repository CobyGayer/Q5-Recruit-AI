/**
 * Excel export utilities for recruits using exceljs
 */

import ExcelJS from "exceljs";
import type { RecruitWithScore } from "@/types/database";
import {
  formatHeight,
  formatArray,
  formatClubLevel,
  shouldIncludeColumn,
} from "./formatters";

export interface ExcelExportOptions {
  includeScores?: boolean;
  includeConfidence?: boolean;
  includeContactInfo?: boolean;
  includeSummarySheet?: boolean;
  selectedColumns?: Record<string, boolean>;
}

interface ExcelRow {
  [key: string]: string | number | boolean | null;
}

function recruitsToExcelRows(
  recruits: RecruitWithScore[],
  options: ExcelExportOptions
): ExcelRow[] {
  return recruits.map((recruit) => {
    const completenessPercent =
      recruit.fields_total > 0 ? (recruit.fields_extracted / recruit.fields_total) * 100 : 0;

    const row: ExcelRow = {};

    // Basic info columns
    if (shouldIncludeColumn("name", options.selectedColumns)) row["Name"] = recruit.full_name || "";
    if (shouldIncludeColumn("email", options.selectedColumns) && options.includeContactInfo) row["Email"] = recruit.email || "";
    if (shouldIncludeColumn("phone", options.selectedColumns) && options.includeContactInfo) row["Phone"] = recruit.phone || "";
    if (shouldIncludeColumn("graduationYear", options.selectedColumns)) row["Grad Year"] = recruit.graduation_year || "";
    if (shouldIncludeColumn("positions", options.selectedColumns)) row["Position"] = formatArray(recruit.positions);

    // Physical attributes
    if (shouldIncludeColumn("height", options.selectedColumns)) row["Height"] = formatHeight(recruit.height_inches);
    if (shouldIncludeColumn("weight", options.selectedColumns)) row["Weight"] = recruit.weight_lbs || "";
    if (shouldIncludeColumn("preferredFoot", options.selectedColumns)) row["Preferred Foot"] = recruit.preferred_foot || "";

    // Academic
    if (shouldIncludeColumn("gpa", options.selectedColumns)) row["GPA"] = recruit.gpa ?? "";
    if (shouldIncludeColumn("satScore", options.selectedColumns)) row["SAT"] = recruit.sat_score || "";
    if (shouldIncludeColumn("actScore", options.selectedColumns)) row["ACT"] = recruit.act_score || "";

    // Location
    if (shouldIncludeColumn("currentSchool", options.selectedColumns)) row["Current School"] = recruit.current_school || "";
    if (shouldIncludeColumn("city", options.selectedColumns)) row["City"] = recruit.city || "";
    if (shouldIncludeColumn("state", options.selectedColumns)) row["State"] = recruit.state || "";
    if (shouldIncludeColumn("country", options.selectedColumns)) row["Country"] = recruit.country || "";

    // Athletic
    if (shouldIncludeColumn("clubTeam", options.selectedColumns)) row["Club Team"] = recruit.club_team || "";
    if (shouldIncludeColumn("clubLevel", options.selectedColumns)) row["Club Level"] = formatClubLevel(recruit.club_level);
    if (shouldIncludeColumn("highSchool", options.selectedColumns)) row["High School"] = recruit.high_school_team || "";
    if (shouldIncludeColumn("videoUrl", options.selectedColumns)) row["Video URL"] = recruit.video_url || "";

    // Data quality
    if (shouldIncludeColumn("completeness", options.selectedColumns)) row["Data Completeness %"] = parseFloat(completenessPercent.toFixed(1));

    // DQS scores
    if (options.includeScores && recruit.dqs_score) {
      if (shouldIncludeColumn("dqsScore", options.selectedColumns)) row["DQS Score"] = recruit.dqs_score.overall_score || "";
      if (shouldIncludeColumn("qualified", options.selectedColumns)) row["Qualified"] = recruit.dqs_score.is_qualified;
      if (shouldIncludeColumn("academicScore", options.selectedColumns)) row["Academic Score"] = recruit.dqs_score.academic_score || "";
      if (shouldIncludeColumn("competitionScore", options.selectedColumns)) row["Competition Score"] = recruit.dqs_score.competition_score || "";
      if (shouldIncludeColumn("physicalScore", options.selectedColumns)) row["Physical Score"] = recruit.dqs_score.physical_score || "";
      if (shouldIncludeColumn("positionFitScore", options.selectedColumns)) row["Position Fit Score"] = recruit.dqs_score.position_fit_score || "";
      if (shouldIncludeColumn("gradYearScore", options.selectedColumns)) row["Grad Year Score"] = recruit.dqs_score.grad_year_score || "";
      if (shouldIncludeColumn("completenessScore", options.selectedColumns)) row["Completeness Score"] = recruit.dqs_score.completeness_score || "";
      if (shouldIncludeColumn("disqualificationReasons", options.selectedColumns)) row["Disqualification Reasons"] = formatArray(recruit.dqs_score.disqualification_reasons);
    }

    if (options.includeConfidence) {
      if (shouldIncludeColumn("fieldsExtracted", options.selectedColumns)) row["Fields Extracted"] = recruit.fields_extracted;
      if (shouldIncludeColumn("fieldsTotal", options.selectedColumns)) row["Fields Total"] = recruit.fields_total;
    }

    if (shouldIncludeColumn("flag", options.selectedColumns))
      row["Flag"] = recruit.flag ? (recruit.flag.flag === "interested" ? "Interested" : "Not a Fit") : "";
    if (shouldIncludeColumn("createdDate", options.selectedColumns)) row["Date Added"] = recruit.created_at || "";

    return row;
  });
}

function addSummarySheet(
  workbook: ExcelJS.Workbook,
  recruits: RecruitWithScore[]
): void {
  const summarySheet = workbook.addWorksheet("Summary");

  // Title
  const titleRow = summarySheet.addRow(["Recruit Export Summary"]);
  titleRow.font = { bold: true, size: 14 };
  summarySheet.addRow([]); // Blank row

  // Basic stats
  const dqsScores = recruits
    .map((r) => r.dqs_score?.overall_score)
    .filter((s) => s !== null && s !== undefined) as number[];
  const averageDQS = dqsScores.length > 0 ? dqsScores.reduce((a, b) => a + b, 0) / dqsScores.length : 0;
  const qualifiedCount = recruits.filter((r) => r.dqs_score?.is_qualified).length;

  const stats = [
    ["Metric", "Value"],
    ["Total Recruits", recruits.length],
    ["Qualified Recruits", qualifiedCount],
    ["Average DQS Score", averageDQS.toFixed(1)],
    ["Recruits with Video", recruits.filter((r) => r.video_url).length],
    ["Recruits Flagged as Interested", recruits.filter((r) => r.flag?.flag === "interested").length],
    ["Average GPA", calculateAverage(recruits.map((r) => r.gpa))],
  ];

  stats.forEach((stat) => {
    const row = summarySheet.addRow(stat);
    if (stat === stats[0]) {
      row.font = { bold: true };
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
    }
  });

  // Column widths
  summarySheet.columns = [{ width: 30 }, { width: 15 }];
}

function calculateAverage(values: (number | null)[]): string {
  const filtered = values.filter((v) => v !== null) as number[];
  if (filtered.length === 0) return "N/A";
  return (filtered.reduce((a, b) => a + b, 0) / filtered.length).toFixed(2);
}

export async function generateExcel(
  recruits: RecruitWithScore[],
  options?: ExcelExportOptions
): Promise<Uint8Array> {
  const mergedOptions: ExcelExportOptions = {
    includeScores: options?.includeScores !== false,
    includeConfidence: options?.includeConfidence !== false,
    includeContactInfo: options?.includeContactInfo !== false,
    includeSummarySheet: options?.includeSummarySheet !== false,
    selectedColumns: options?.selectedColumns,
  };

  const workbook = new ExcelJS.Workbook();

  // Main data sheet
  const worksheet = workbook.addWorksheet("Recruits");

  if (recruits.length === 0) {
    worksheet.addRow(["No recruits to export"]);
    const buffer = await workbook.xlsx.writeBuffer();
    // exceljs writeBuffer() returns Buffer | Uint8Array; cast needed for Uint8Array compat
    return buffer as unknown as Uint8Array;
  }

  const rows = recruitsToExcelRows(recruits, mergedOptions);
  const headers = Object.keys(rows[0]);

  // Add header row
  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };

  // Add data rows
  rows.forEach((row) => {
    worksheet.addRow(headers.map((h) => row[h] ?? ""));
  });

  // Auto-adjust column widths
  worksheet.columns = headers.map((header) => {
    const columnWidth = Math.max(header.length + 2, 12);
    return { width: Math.min(columnWidth, 50) };
  });

  // Add summary sheet if requested
  if (mergedOptions.includeSummarySheet) {
    addSummarySheet(workbook, recruits);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  // exceljs writeBuffer() returns Buffer | Uint8Array; cast needed for Uint8Array compat
  return buffer as unknown as Uint8Array;
}

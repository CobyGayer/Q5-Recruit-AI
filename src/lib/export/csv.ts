/**
 * CSV export utilities for recruits
 */

import type { RecruitWithScore } from "@/types/database";
import {
  formatHeight,
  formatPercentage,
  formatScore,
  formatArray,
  formatClubLevel,
  shouldIncludeColumn,
} from "./formatters";

export interface ExportOptions {
  includeScores?: boolean;
  includeConfidence?: boolean;
  includeContactInfo?: boolean;
  selectedColumns?: Record<string, boolean>;
}

const DEFAULT_OPTIONS: ExportOptions = {
  includeScores: true,
  includeConfidence: true,
  includeContactInfo: true,
  selectedColumns: undefined,
};

interface CSVRow {
  [key: string]: string | number | null;
}

function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);

  // Quote if contains comma, newline, or quotes
  if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function recruitsToCSVRows(
  recruits: RecruitWithScore[],
  options: ExportOptions
): CSVRow[] {
  const includeScores = options.includeScores !== false;
  const includeConfidence = options.includeConfidence !== false;
  const includeContactInfo = options.includeContactInfo !== false;
  const sel = options.selectedColumns;

  return recruits.map((recruit) => {
    const completenessPercent =
      recruit.fields_total > 0 ? (recruit.fields_extracted / recruit.fields_total) * 100 : 0;
    const row: CSVRow = {};

    if (shouldIncludeColumn("name", sel)) row["Name"] = recruit.full_name || "";
    if (shouldIncludeColumn("email", sel) && includeContactInfo) row["Email"] = recruit.email || "";
    if (shouldIncludeColumn("phone", sel) && includeContactInfo) row["Phone"] = recruit.phone || "";
    if (shouldIncludeColumn("graduationYear", sel)) row["Grad Year"] = recruit.graduation_year || "";
    if (shouldIncludeColumn("positions", sel)) row["Position"] = formatArray(recruit.positions);
    if (shouldIncludeColumn("height", sel)) row["Height"] = formatHeight(recruit.height_inches);
    if (shouldIncludeColumn("weight", sel)) row["Weight"] = recruit.weight_lbs || "";
    if (shouldIncludeColumn("preferredFoot", sel)) row["Preferred Foot"] = recruit.preferred_foot || "";
    if (shouldIncludeColumn("gpa", sel)) row["GPA"] = formatScore(recruit.gpa);
    if (shouldIncludeColumn("satScore", sel)) row["SAT"] = recruit.sat_score || "";
    if (shouldIncludeColumn("actScore", sel)) row["ACT"] = recruit.act_score || "";
    if (shouldIncludeColumn("currentSchool", sel)) row["Current School"] = recruit.current_school || "";
    if (shouldIncludeColumn("city", sel)) row["City"] = recruit.city || "";
    if (shouldIncludeColumn("state", sel)) row["State"] = recruit.state || "";
    if (shouldIncludeColumn("country", sel)) row["Country"] = recruit.country || "";
    if (shouldIncludeColumn("clubTeam", sel)) row["Club Team"] = recruit.club_team || "";
    if (shouldIncludeColumn("clubLevel", sel)) row["Club Level"] = formatClubLevel(recruit.club_level);
    if (shouldIncludeColumn("highSchool", sel)) row["High School"] = recruit.high_school_team || "";
    if (shouldIncludeColumn("videoUrl", sel)) row["Video URL"] = recruit.video_url || "";
    if (shouldIncludeColumn("completeness", sel)) row["Data Completeness %"] = formatPercentage(completenessPercent);

    if (includeScores && recruit.dqs_score) {
      if (shouldIncludeColumn("dqsScore", sel)) row["DQS Score"] = formatScore(recruit.dqs_score.overall_score);
      if (shouldIncludeColumn("qualified", sel)) row["Qualified"] = recruit.dqs_score.is_qualified ? "Yes" : "No";
      if (shouldIncludeColumn("academicScore", sel)) row["Academic Score"] = formatScore(recruit.dqs_score.academic_score);
      if (shouldIncludeColumn("competitionScore", sel)) row["Competition Score"] = formatScore(recruit.dqs_score.competition_score);
      if (shouldIncludeColumn("physicalScore", sel)) row["Physical Score"] = formatScore(recruit.dqs_score.physical_score);
      if (shouldIncludeColumn("positionFitScore", sel)) row["Position Fit Score"] = formatScore(recruit.dqs_score.position_fit_score);
      if (shouldIncludeColumn("gradYearScore", sel)) row["Grad Year Score"] = formatScore(recruit.dqs_score.grad_year_score);
      if (shouldIncludeColumn("completenessScore", sel)) row["Completeness Score"] = formatScore(recruit.dqs_score.completeness_score);
      if (shouldIncludeColumn("disqualificationReasons", sel)) row["Disqualification Reasons"] = formatArray(recruit.dqs_score.disqualification_reasons);
    }

    if (includeConfidence) {
      if (shouldIncludeColumn("fieldsExtracted", sel)) row["Fields Extracted"] = recruit.fields_extracted;
      if (shouldIncludeColumn("fieldsTotal", sel)) row["Fields Total"] = recruit.fields_total;
    }

    if (shouldIncludeColumn("flag", sel)) row["Flag"] = recruit.flag ? (recruit.flag.flag === "interested" ? "Interested" : "Not a Fit") : "";
    if (shouldIncludeColumn("createdDate", sel)) row["Date Added"] = recruit.created_at || "";

    return row;
  });
}

function csvRowsToString(rows: CSVRow[]): string {
  if (rows.length === 0) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const headerLine = headers.map(escapeCSVValue).join(",");

  const dataLines = rows.map((row) => headers.map((h) => escapeCSVValue(row[h])).join(","));

  return [headerLine, ...dataLines].join("\n");
}

export function generateCSV(
  recruits: RecruitWithScore[],
  options?: ExportOptions
): string {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const rows = recruitsToCSVRows(recruits, mergedOptions);
  return csvRowsToString(rows);
}

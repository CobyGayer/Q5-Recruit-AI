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

function escapeCSVValue(value: any): string {
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
  const selectedColumns = options.selectedColumns;

  // If selectedColumns is provided, only include those columns
  const useColumnSelection = selectedColumns && Object.keys(selectedColumns).length > 0;

  return recruits.map((recruit) => {
    const completenessPercent =
      recruit.fields_total > 0 ? (recruit.fields_extracted / recruit.fields_total) * 100 : 0;

    // Build the full row with all possible columns
    const fullRow: CSVRow = {
      name: recruit.full_name || "",
      email: recruit.email || "",
      phone: recruit.phone || "",
      graduationYear: recruit.graduation_year || "",
      positions: formatArray(recruit.positions),
      height: formatHeight(recruit.height_inches),
      weight: recruit.weight_lbs || "",
      gpa: formatScore(recruit.gpa),
      satScore: recruit.sat_score || "",
      actScore: recruit.act_score || "",
      currentSchool: recruit.current_school || "",
      city: recruit.city || "",
      state: recruit.state || "",
      country: recruit.country || "",
      clubTeam: recruit.club_team || "",
      clubLevel: formatClubLevel(recruit.club_level),
      highSchool: recruit.high_school_team || "",
      preferredFoot: recruit.preferred_foot || "",
      videoUrl: recruit.video_url || "",
      completeness: formatPercentage(completenessPercent),
      dqsScore: includeScores && recruit.dqs_score ? formatScore(recruit.dqs_score.overall_score) : "",
      qualified: includeScores && recruit.dqs_score ? (recruit.dqs_score.is_qualified ? "Yes" : "No") : "",
      academicScore: includeScores && recruit.dqs_score ? formatScore(recruit.dqs_score.academic_score) : "",
      competitionScore: includeScores && recruit.dqs_score ? formatScore(recruit.dqs_score.competition_score) : "",
      physicalScore: includeScores && recruit.dqs_score ? formatScore(recruit.dqs_score.physical_score) : "",
      positionFitScore: includeScores && recruit.dqs_score ? formatScore(recruit.dqs_score.position_fit_score) : "",
      gradYearScore: includeScores && recruit.dqs_score ? formatScore(recruit.dqs_score.grad_year_score) : "",
      completenessScore: includeScores && recruit.dqs_score ? formatScore(recruit.dqs_score.completeness_score) : "",
      disqualificationReasons: includeScores && recruit.dqs_score ? formatArray(recruit.dqs_score.disqualification_reasons) : "",
      fieldsExtracted: includeConfidence ? recruit.fields_extracted : "",
      confidence: includeConfidence && recruit.flag ? (recruit.flag.flag === "interested" ? "Interested" : "Not a Fit") : "",
      flag: recruit.flag ? (recruit.flag.flag === "interested" ? "Interested" : "Not a Fit") : "",
      createdDate: recruit.created_at || "",
    };

    // If column selection is active, filter to selected columns
    if (useColumnSelection) {
      const filtered: CSVRow = {};
      Object.keys(selectedColumns).forEach((key) => {
        if (selectedColumns[key] && key in fullRow) {
          filtered[key] = fullRow[key];
        }
      });
      return filtered;
    }

    return fullRow;
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

export function downloadCSV(content: string, filename: string = "recruits.csv"): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

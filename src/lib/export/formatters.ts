/**
 * Shared formatting utilities for spreadsheet exports
 */

export const CLUB_LEVEL_LABELS: Record<string, string> = {
  mls_next: "MLS Next",
  ecnl: "ECNL",
  ga: "GA",
  regional: "Regional",
  other: "Other",
  unknown: "Unknown",
};

export function formatHeight(inches: number | null): string {
  if (inches === null || inches === undefined) return "";
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

export function formatPercentage(value: number | null): string {
  if (value === null || value === undefined) return "";
  return `${Math.round(value)}%`;
}

export function formatScore(value: number | null): string {
  if (value === null || value === undefined) return "";
  return value.toFixed(1);
}

export function formatArray(arr: string[] | null): string {
  if (!arr || arr.length === 0) return "";
  return arr.join(", ");
}

export function formatBoolean(value: boolean | null): string {
  if (value === null || value === undefined) return "";
  return value ? "Yes" : "No";
}

export function formatClubLevel(level: string | null): string {
  if (!level) return "";
  return CLUB_LEVEL_LABELS[level] || level;
}

export function shouldIncludeColumn(columnKey: string, selectedColumns?: Record<string, boolean>): boolean {
  if (!selectedColumns) return true;
  return selectedColumns[columnKey] === true;
}

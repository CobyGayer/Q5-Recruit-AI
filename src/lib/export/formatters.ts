/**
 * Shared formatting utilities for spreadsheet exports
 */

export const CLUB_LEVEL_LABELS: Record<string, string> = {
  mls_next: "MLS Next",
  mls_next_homegrown: "MLS Next - Homegrown",
  mls_next_academy: "MLS Next - Academy",
  ecnl: "ECNL",
  ecrl: "ECRL",
  ga: "GA",
  ga_aspire: "GA Aspire",
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

export function splitFullName(fullName: string | null | undefined): {
  firstName: string;
  lastName: string;
} {
  const normalized = (fullName ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) {
    return { firstName: "", lastName: "" };
  }

  const firstSpace = normalized.indexOf(" ");
  if (firstSpace === -1) {
    return { firstName: normalized, lastName: "" };
  }

  return {
    firstName: normalized.slice(0, firstSpace),
    lastName: normalized.slice(firstSpace + 1),
  };
}

export function shouldIncludeColumn(columnKey: string, selectedColumns?: Record<string, boolean>): boolean {
  if (!selectedColumns) return true;
  return selectedColumns[columnKey] === true;
}

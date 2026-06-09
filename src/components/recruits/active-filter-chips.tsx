"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { RecruitFilters } from "@/types/recruit";
import { DEFAULT_FILTERS } from "@/types/recruit";

interface FilterChip {
  key: keyof RecruitFilters;
  label: string;
}

const FLAG_LABELS: Record<string, string> = {
  interested: "Starred",
  not_a_fit: "Not a Fit",
};

interface ActiveFilterChipsProps {
  filters: RecruitFilters;
  searchTerm: string;
  onRemoveFilter: (key: keyof RecruitFilters) => void;
  onClearSearch: () => void;
  onClearAll: () => void;
}

function getActiveChips(
  filters: RecruitFilters,
  searchTerm: string
): (FilterChip | { key: "search"; label: string })[] {
  const chips: (FilterChip | { key: "search"; label: string })[] = [];

  if (searchTerm) {
    chips.push({
      key: "search",
      label: `"${searchTerm}"`,
    });
  }

  if (filters.graduation_years.length > 0) {
    chips.push({
      key: "graduation_years",
      label: `Year: ${filters.graduation_years.join(", ")}`,
    });
  }

  if (filters.positions.length > 0) {
    chips.push({
      key: "positions",
      label: `Pos: ${filters.positions.join(", ")}`,
    });
  }

  if (filters.flag_filter !== "all") {
    chips.push({
      key: "flag_filter",
      label: FLAG_LABELS[filters.flag_filter] ?? filters.flag_filter,
    });
  }

  if (filters.min_gpa != null) {
    chips.push({
      key: "min_gpa",
      label: `Unweighted GPA \u2265 ${filters.min_gpa}`,
    });
  }

  if (filters.min_height != null) {
    const ft = Math.floor(filters.min_height / 12);
    const inches = filters.min_height % 12;
    chips.push({
      key: "min_height",
      label: `Height \u2265 ${ft}'${inches}"`,
    });
  }

  if (filters.min_sat != null) {
    chips.push({
      key: "min_sat",
      label: `SAT \u2265 ${filters.min_sat}`,
    });
  }

  if (filters.min_act != null) {
    chips.push({
      key: "min_act",
      label: `ACT \u2265 ${filters.min_act}`,
    });
  }

  if (filters.club_levels.length > 0) {
    const CLUB_LABELS: Record<string, string> = {
      mls_next: "MLS NEXT",
      mls_next_homegrown: "MLS NEXT - Homegrown",
      mls_next_academy: "MLS NEXT - Academy",
      ecnl: "ECNL",
      ecrl: "ECRL",
      ga: "GA",
      ga_aspire: "GA Aspire",
      nal: "NAL",
      dpl: "DPL",
      other: "Other",
      unknown: "Unknown",
    };
    chips.push({
      key: "club_levels",
      label: `Club: ${filters.club_levels.map((c) => CLUB_LABELS[c] ?? c).join(", ")}`,
    });
  }

  if (filters.location) {
    chips.push({
      key: "location",
      label: `Location: ${filters.location}`,
    });
  }

  if (filters.dqs_min > 0 || filters.dqs_max < 100) {
    chips.push({
      key: "dqs_min",
      label: `DQS: ${filters.dqs_min}\u2013${filters.dqs_max}`,
    });
  }

  if (filters.completeness_min > 0) {
    chips.push({
      key: "completeness_min",
      label: `Data \u2265 ${filters.completeness_min}%`,
    });
  }

  if (filters.has_video) {
    chips.push({ key: "has_video", label: "Has Video" });
  }

  if (filters.show_not_qualified) {
    chips.push({ key: "show_not_qualified", label: "Including Disqualified" });
  }

  if (filters.needs_review) {
    chips.push({ key: "needs_review", label: "Needs Review" });
  }

  return chips;
}

export function ActiveFilterChips({
  filters,
  searchTerm,
  onRemoveFilter,
  onClearSearch,
  onClearAll,
}: ActiveFilterChipsProps) {
  const chips = getActiveChips(filters, searchTerm);

  if (chips.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant="secondary"
          className="gap-1 pr-1 text-xs font-normal"
        >
          {chip.label}
          <button
            onClick={() => {
              if (chip.key === "search") {
                onClearSearch();
              } else {
                onRemoveFilter(chip.key as keyof RecruitFilters);
              }
            }}
            className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {chips.length >= 2 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs text-muted-foreground px-2"
          onClick={onClearAll}
        >
          Clear all
        </Button>
      )}
    </div>
  );
}

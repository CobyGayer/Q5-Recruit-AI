"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RecruitFilters, SortOption, SortDirection } from "@/types/recruit";
import { SORT_LABELS, DEFAULT_SORT_DIRECTIONS } from "@/types/recruit";
import { ChevronUp, ChevronDown } from "lucide-react";

interface RecruitFiltersProps {
  filters: RecruitFilters;
  onChange: (updates: Partial<RecruitFilters>) => void;
  onReset: () => void;
  // Sort
  sortBy: SortOption;
  sortDir: SortDirection;
  onSortChange: (sort: SortOption) => void;
  onSortDirChange: (dir: SortDirection) => void;
}

const CLUB_LEVELS = [
  { value: "mls_next", label: "MLS Next" },
  { value: "mls_next_homegrown", label: "MLS Next - Homegrown" },
  { value: "mls_next_academy", label: "MLS Next - Academy" },
  { value: "ecnl", label: "ECNL" },
  { value: "ecrl", label: "ECRL" },
  { value: "ga", label: "GA" },
  { value: "regional", label: "Regional" },
  { value: "other", label: "Other" },
  { value: "unknown", label: "Unknown" },
];

export function RecruitFilterPanel({
  filters,
  onChange,
  onReset,
  sortBy,
  sortDir,
  onSortChange,
  onSortDirChange,
}: RecruitFiltersProps) {
  function toggleClubLevel(value: string) {
    const arr = filters.club_levels;
    const updated = arr.includes(value)
      ? arr.filter((v) => v !== value)
      : [...arr, value];
    onChange({ club_levels: updated });
  }

  function handleSortClick(option: SortOption) {
    if (option === sortBy) {
      onSortDirChange(sortDir === "asc" ? "desc" : "asc");
    } else {
      onSortChange(option);
      onSortDirChange(DEFAULT_SORT_DIRECTIONS[option]);
    }
  }

  return (
    <div className="space-y-5 p-4 border rounded-lg bg-card">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Filters & Sort</h3>
        <Button variant="ghost" size="sm" onClick={onReset}>
          Reset
        </Button>
      </div>

      {/* Sort */}
      <div className="space-y-2">
        <Label className="text-xs">Sort By</Label>
        <div className="space-y-0.5">
          {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
            <button
              key={option}
              onClick={() => handleSortClick(option)}
              className={`flex items-center justify-between w-full px-2.5 py-1.5 text-sm rounded-md transition-colors ${
                sortBy === option
                  ? "bg-secondary font-medium"
                  : "hover:bg-muted"
              }`}
            >
              {SORT_LABELS[option]}
              {sortBy === option && (
                sortDir === "asc" ? (
                  <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                )
              )}
            </button>
          ))}
        </div>
      </div>

      {/* DQS Range + Show Not Qualified */}
      <div className="space-y-2">
        <Label className="text-xs">
          DQS Range: {filters.dqs_min}–{filters.dqs_max}
        </Label>
        <Slider
          min={0}
          max={100}
          step={5}
          value={[filters.dqs_min, filters.dqs_max]}
          onValueChange={([min, max]) =>
            onChange({ dqs_min: min, dqs_max: max })
          }
        />
        <div className="flex items-center gap-2 pt-1">
          <Checkbox
            id="show_nq"
            checked={filters.show_not_qualified}
            onCheckedChange={(checked) =>
              onChange({ show_not_qualified: checked === true })
            }
          />
          <Label htmlFor="show_nq" className="text-xs">
            Include disqualified recruits
          </Label>
        </div>
      </div>

      {/* Numeric filters */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Min GPA</Label>
          <Input
            type="number"
            step="0.1"
            min="0"
            max="4.0"
            placeholder="Any"
            value={filters.min_gpa ?? ""}
            onChange={(e) =>
              onChange({
                min_gpa: e.target.value ? parseFloat(e.target.value) : null,
              })
            }
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Min Height (in)</Label>
          <Input
            type="number"
            min="60"
            max="84"
            placeholder="Any"
            value={filters.min_height ?? ""}
            onChange={(e) =>
              onChange({
                min_height: e.target.value ? parseInt(e.target.value) : null,
              })
            }
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Min SAT</Label>
          <Input
            type="number"
            min="400"
            max="1600"
            placeholder="Any"
            value={filters.min_sat ?? ""}
            onChange={(e) =>
              onChange({
                min_sat: e.target.value ? parseInt(e.target.value) : null,
              })
            }
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Min ACT</Label>
          <Input
            type="number"
            min="1"
            max="36"
            placeholder="Any"
            value={filters.min_act ?? ""}
            onChange={(e) =>
              onChange({
                min_act: e.target.value ? parseInt(e.target.value) : null,
              })
            }
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Club Level */}
      <div className="space-y-2">
        <Label className="text-xs">Club Level</Label>
        <div className="flex flex-wrap gap-1.5">
          {CLUB_LEVELS.map((level) => (
            <Badge
              key={level.value}
              variant={
                filters.club_levels.includes(level.value)
                  ? "default"
                  : "outline"
              }
              className="cursor-pointer text-xs"
              onClick={() => toggleClubLevel(level.value)}
            >
              {level.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Location search */}
      <div className="space-y-1">
        <Label className="text-xs">Location</Label>
        <Input
          placeholder="City, state, or country"
          value={filters.location}
          onChange={(e) => onChange({ location: e.target.value })}
          className="h-8 text-sm"
        />
      </div>

      {/* Completeness */}
      <div className="space-y-2">
        <Label className="text-xs">
          Min Completeness: {filters.completeness_min}%
        </Label>
        <Slider
          min={0}
          max={100}
          step={5}
          value={[filters.completeness_min]}
          onValueChange={([val]) => onChange({ completeness_min: val })}
        />
      </div>

      {/* Checkboxes */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="has_video"
            checked={filters.has_video}
            onCheckedChange={(checked) =>
              onChange({ has_video: checked === true })
            }
          />
          <Label htmlFor="has_video" className="text-xs">
            Has highlight video
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="needs_review"
            checked={filters.needs_review}
            onCheckedChange={(checked) =>
              onChange({ needs_review: checked === true })
            }
          />
          <Label htmlFor="needs_review" className="text-xs">
            Needs review only
          </Label>
        </div>
      </div>
    </div>
  );
}

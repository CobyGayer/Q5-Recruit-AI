"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { POSITIONS, GRAD_YEARS } from "@/types/config";
import type { RecruitFilters } from "@/types/recruit";
import { DEFAULT_FILTERS } from "@/types/recruit";
import { RotateCcw } from "lucide-react";

interface RecruitFiltersProps {
  filters: RecruitFilters;
  onChange: (filters: RecruitFilters) => void;
}

const CLUB_LEVELS = [
  { value: "mls_next", label: "MLS Next" },
  { value: "ecnl", label: "ECNL" },
  { value: "ga", label: "GA" },
  { value: "regional", label: "Regional" },
  { value: "other", label: "Other" },
];

export function RecruitFilterPanel({ filters, onChange }: RecruitFiltersProps) {
  function toggleArrayItem(
    key: "graduation_years" | "positions" | "club_levels",
    value: string | number
  ) {
    const arr = filters[key] as (string | number)[];
    const updated = arr.includes(value)
      ? arr.filter((v) => v !== value)
      : [...arr, value];
    onChange({ ...filters, [key]: updated });
  }

  function resetFilters() {
    onChange(DEFAULT_FILTERS);
  }

  return (
    <div className="space-y-5 p-4 border rounded-lg bg-card">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Filters</h3>
        <Button variant="ghost" size="sm" onClick={resetFilters}>
          <RotateCcw className="h-3 w-3 mr-1" />
          Reset
        </Button>
      </div>

      {/* Graduation Year */}
      <div className="space-y-2">
        <Label className="text-xs">Graduation Year</Label>
        <div className="flex flex-wrap gap-1.5">
          {GRAD_YEARS.map((year) => (
            <Badge
              key={year}
              variant={
                filters.graduation_years.includes(year) ? "default" : "outline"
              }
              className="cursor-pointer text-xs"
              onClick={() => toggleArrayItem("graduation_years", year)}
            >
              {year}
            </Badge>
          ))}
        </div>
      </div>

      {/* Position */}
      <div className="space-y-2">
        <Label className="text-xs">Position</Label>
        <div className="flex flex-wrap gap-1.5">
          {POSITIONS.map((pos) => (
            <Badge
              key={pos}
              variant={
                filters.positions.includes(pos) ? "default" : "outline"
              }
              className="cursor-pointer text-xs"
              onClick={() => toggleArrayItem("positions", pos)}
            >
              {pos}
            </Badge>
          ))}
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
                ...filters,
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
                ...filters,
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
                ...filters,
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
                ...filters,
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
              onClick={() => toggleArrayItem("club_levels", level.value)}
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
          onChange={(e) => onChange({ ...filters, location: e.target.value })}
          className="h-8 text-sm"
        />
      </div>

      {/* DQS Range */}
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
            onChange({ ...filters, dqs_min: min, dqs_max: max })
          }
        />
      </div>

      {/* Checkboxes */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="has_video"
            checked={filters.has_video}
            onCheckedChange={(checked) =>
              onChange({ ...filters, has_video: checked === true })
            }
          />
          <Label htmlFor="has_video" className="text-xs">
            Has highlight video
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="show_nq"
            checked={filters.show_not_qualified}
            onCheckedChange={(checked) =>
              onChange({ ...filters, show_not_qualified: checked === true })
            }
          />
          <Label htmlFor="show_nq" className="text-xs">
            Show Not Qualified
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="needs_review"
            checked={filters.needs_review}
            onCheckedChange={(checked) =>
              onChange({ ...filters, needs_review: checked === true })
            }
          />
          <Label htmlFor="needs_review" className="text-xs">
            Needs Review only
          </Label>
        </div>
      </div>
    </div>
  );
}

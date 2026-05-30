"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { POSITIONS, GRAD_YEARS, FOOT_OPTIONS } from "@/types/config";
import type { PreferredFoot, ThresholdFormData } from "@/types/config";

interface ThresholdFormProps {
  data: ThresholdFormData;
  onChange: (data: ThresholdFormData) => void;
}

export function ThresholdForm({ data, onChange }: ThresholdFormProps) {
  function toggleGradYear(year: number) {
    const years = data.accepted_grad_years.includes(year)
      ? data.accepted_grad_years.filter((y) => y !== year)
      : [...data.accepted_grad_years, year];
    onChange({ ...data, accepted_grad_years: years });
  }

  function togglePosition(pos: string) {
    const removing = data.accepted_positions.includes(pos);
    const positions = removing
      ? data.accepted_positions.filter((p) => p !== pos)
      : [...data.accepted_positions, pos];

    if (!removing) {
      onChange({ ...data, accepted_positions: positions });
      return;
    }

    const minHeight = { ...data.min_height_by_position };
    delete minHeight[pos];
    const foot = { ...data.preferred_foot_by_position };
    delete foot[pos];
    const range = { ...data.preferred_height_range_by_position };
    delete range[pos];

    onChange({
      ...data,
      accepted_positions: positions,
      min_height_by_position: minHeight,
      preferred_foot_by_position: foot,
      preferred_height_range_by_position: range,
    });
  }

  function updatePreferredFoot(position: string, foot: PreferredFoot | null) {
    const updated = { ...data.preferred_foot_by_position };
    if (foot) {
      updated[position] = foot;
    } else {
      delete updated[position];
    }
    onChange({ ...data, preferred_foot_by_position: updated });
  }

  function updateHeightRange(position: string, bound: "min" | "max", value: string) {
    const parsed = value === "" ? undefined : Number(value);
    if (parsed !== undefined && !Number.isInteger(parsed)) {
      return;
    }
    const existing = data.preferred_height_range_by_position[position] ?? {};
    const updated = { ...data.preferred_height_range_by_position };
    const next = { ...existing, [bound]: parsed };
    if (next.min === undefined && next.max === undefined) {
      delete updated[position];
    } else {
      updated[position] = next;
    }
    onChange({ ...data, preferred_height_range_by_position: updated });
  }
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Minimum Thresholds</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Athletes who don&apos;t meet these requirements will be marked as
          &quot;Not Qualified&quot; and hidden from your default dashboard view.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="min_gpa">Minimum GPA (optional)</Label>
          <Input
            id="min_gpa"
            type="number"
            step="0.1"
            min="0"
            max="4.0"
            placeholder="3.0"
            value={data.min_gpa ?? ""}
            onChange={(e) =>
              onChange({
                ...data,
                min_gpa: e.target.value ? parseFloat(e.target.value) : null,
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="min_sat">Minimum SAT (optional)</Label>
          <Input
            id="min_sat"
            type="number"
            min="400"
            max="1600"
            placeholder="1100"
            value={data.min_sat ?? ""}
            onChange={(e) =>
              onChange({
                ...data,
                min_sat: e.target.value ? parseInt(e.target.value, 10) : null,
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="min_act">Minimum ACT (optional)</Label>
          <Input
            id="min_act"
            type="number"
            min="1"
            max="36"
            placeholder="24"
            value={data.min_act ?? ""}
            onChange={(e) =>
              onChange({
                ...data,
                min_act: e.target.value ? parseInt(e.target.value, 10) : null,
              })
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Accepted Graduation Years</Label>
        <div className="flex flex-wrap gap-2">
          {GRAD_YEARS.map((year) => (
            <Badge
              key={year}
              variant={
                data.accepted_grad_years.includes(year) ? "default" : "outline"
              }
              className="cursor-pointer text-sm px-3 py-1"
              onClick={() => toggleGradYear(year)}
            >
              {year}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Accepted Positions</Label>
        <div className="flex flex-wrap gap-2">
          {POSITIONS.map((pos) => (
            <Badge
              key={pos}
              variant={
                data.accepted_positions.includes(pos) ? "default" : "outline"
              }
              className="cursor-pointer text-sm px-3 py-1"
              onClick={() => togglePosition(pos)}
            >
              {pos}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Preferred Foot by Position (optional)</Label>
        <p className="text-xs text-muted-foreground">
          This is a soft preference and won&apos;t disqualify recruits.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {data.accepted_positions.map((pos) => (
            <div key={pos} className="space-y-1">
              <Label className="text-xs">{pos}</Label>
              <Select
                value={data.preferred_foot_by_position[pos] ?? ""}
                onValueChange={(val) => {
                  const foot = FOOT_OPTIONS.find((option) => option === val);
                  updatePreferredFoot(pos, foot ?? null);
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="No pref." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__clear__">No preference</SelectItem>
                  {FOOT_OPTIONS.map((foot) => (
                    <SelectItem key={foot} value={foot}>{foot}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          {data.accepted_positions.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full">
              Select positions above to set foot preferences.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Preferred Height Range by Position (optional, in inches)</Label>
        <p className="text-xs text-muted-foreground">
          Set a preferred height range per position. This is a soft preference and won&apos;t disqualify recruits.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.accepted_positions.map((pos) => {
            const range = data.preferred_height_range_by_position[pos] ?? {};
            const rangeInvalid =
              range.min !== undefined &&
              range.max !== undefined &&
              range.min > range.max;
            return (
              <div key={pos} className="space-y-1">
                <Label className="text-xs">{pos}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="60"
                    max="84"
                    placeholder="Min"
                    value={range.min ?? ""}
                    onChange={(e) => updateHeightRange(pos, "min", e.target.value)}
                    className="text-xs"
                    aria-label={`Minimum height for ${pos}`}
                  />
                  <span className="text-xs text-muted-foreground shrink-0">to</span>
                  <Input
                    type="number"
                    min="60"
                    max="84"
                    placeholder="Max"
                    value={range.max ?? ""}
                    onChange={(e) => updateHeightRange(pos, "max", e.target.value)}
                    className="text-xs"
                    aria-label={`Maximum height for ${pos}`}
                  />
                </div>
                {rangeInvalid && (
                  <p className="text-xs text-destructive">Min must be ≤ max.</p>
                )}
              </div>
            );
          })}
          {data.accepted_positions.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full">
              Select positions above to set height ranges.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

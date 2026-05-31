"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FOOT_OPTIONS, FIT_BOOST_MIN, FIT_BOOST_MAX } from "@/types/config";
import type { PreferredFoot, ThresholdFormData } from "@/types/config";

// Radix's SelectItem disallows an empty-string value, so the "no preference"
// option needs a non-empty sentinel. Kept explicit (rather than relying on a
// lookup miss) so it can never collide with a real FOOT_OPTIONS value.
const NO_FOOT_PREFERENCE = "__none__";

interface SoftPreferencesFormProps {
  data: ThresholdFormData;
  onChange: (data: ThresholdFormData) => void;
}

export function SoftPreferencesForm({ data, onChange }: SoftPreferencesFormProps) {
  function updateBoostMagnitude(
    field: "boost_preferred_foot" | "boost_preferred_height",
    value: string
  ) {
    const parsed = value === "" ? 0 : Number(value);
    if (!Number.isInteger(parsed)) return;
    const clamped = Math.max(FIT_BOOST_MIN, Math.min(FIT_BOOST_MAX, parsed));
    onChange({ ...data, [field]: clamped });
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
        <h3 className="text-lg font-semibold mb-1">Preferred Foot &amp; Height</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Soft preferences that nudge a recruit&apos;s DQS up when they match.
          They add points but{" "}
          <span className="font-medium text-foreground">never disqualify</span>{" "}
          a recruit — a wrong-footed prospect simply doesn&apos;t earn the boost.
          You set how many points each match is worth (0&ndash;{FIT_BOOST_MAX});
          all boosts are added on the same 0&ndash;100 scale as the DQS and
          capped so they can&apos;t overwhelm the core score. Positions are set
          on the Thresholds tab.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Label>Preferred Foot by Position (optional)</Label>
          <div className="flex items-center gap-2">
            <Label htmlFor="boost_preferred_foot" className="text-xs text-muted-foreground">
              Points when matched
            </Label>
            <Input
              id="boost_preferred_foot"
              type="number"
              min={FIT_BOOST_MIN}
              max={FIT_BOOST_MAX}
              value={data.boost_preferred_foot}
              onChange={(e) => updateBoostMagnitude("boost_preferred_foot", e.target.value)}
              className="h-9 w-20 text-xs"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          &quot;Either&quot; means no preference. Two-footed recruits satisfy any
          preference.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {data.accepted_positions.map((pos) => (
            <div key={pos} className="space-y-1">
              <Label className="text-xs">{pos}</Label>
              <Select
                value={data.preferred_foot_by_position[pos] ?? ""}
                onValueChange={(val) => {
                  if (val === NO_FOOT_PREFERENCE) {
                    updatePreferredFoot(pos, null);
                    return;
                  }
                  const foot = FOOT_OPTIONS.find((option) => option === val);
                  updatePreferredFoot(pos, foot ?? null);
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="No pref." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_FOOT_PREFERENCE}>No preference</SelectItem>
                  {FOOT_OPTIONS.map((foot) => (
                    <SelectItem key={foot} value={foot}>{foot}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          {data.accepted_positions.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full">
              Select positions on the Thresholds tab to set foot preferences.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Label>Preferred Height Range by Position (optional, in inches)</Label>
          <div className="flex items-center gap-2">
            <Label htmlFor="boost_preferred_height" className="text-xs text-muted-foreground">
              Points when matched
            </Label>
            <Input
              id="boost_preferred_height"
              type="number"
              min={FIT_BOOST_MIN}
              max={FIT_BOOST_MAX}
              value={data.boost_preferred_height}
              onChange={(e) => updateBoostMagnitude("boost_preferred_height", e.target.value)}
              className="h-9 w-20 text-xs"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Recruits whose height falls within the range earn the points above.
          This is a soft preference and won&apos;t disqualify recruits.
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
                    aria-label={`Minimum preferred height for ${pos}`}
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
                    aria-label={`Maximum preferred height for ${pos}`}
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
              Select positions on the Thresholds tab to set height ranges.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

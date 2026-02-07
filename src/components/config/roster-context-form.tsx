"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { POSITIONS, GRAD_YEARS } from "@/types/config";
import type { RosterContextFormData } from "@/types/config";
import { Plus, X } from "lucide-react";

interface RosterContextFormProps {
  data: RosterContextFormData;
  onChange: (data: RosterContextFormData) => void;
}

export function RosterContextForm({ data, onChange }: RosterContextFormProps) {
  function addHighNeedPosition(position: string) {
    if (data.high_need_positions.some((p) => p.position === position)) return;
    const rank = data.high_need_positions.length + 1;
    onChange({
      ...data,
      high_need_positions: [...data.high_need_positions, { position, rank }],
    });
  }

  function removeHighNeedPosition(position: string) {
    const filtered = data.high_need_positions
      .filter((p) => p.position !== position)
      .map((p, i) => ({ ...p, rank: i + 1 }));
    onChange({ ...data, high_need_positions: filtered });
  }

  function addPriorityGradYear(year: number) {
    if (data.priority_grad_years.some((y) => y.year === year)) return;
    const rank = data.priority_grad_years.length + 1;
    onChange({
      ...data,
      priority_grad_years: [...data.priority_grad_years, { year, rank }],
    });
  }

  function removePriorityGradYear(year: number) {
    const filtered = data.priority_grad_years
      .filter((y) => y.year !== year)
      .map((y, i) => ({ ...y, rank: i + 1 }));
    onChange({ ...data, priority_grad_years: filtered });
  }

  function updateRosterSpots(year: string, spots: string) {
    const updated = { ...data.roster_spots };
    if (spots) {
      updated[year] = parseInt(spots, 10);
    } else {
      delete updated[year];
    }
    onChange({ ...data, roster_spots: updated });
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Roster Context</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Optional: This information helps boost scores for recruits who match
          your most urgent needs.
        </p>
      </div>

      <div className="space-y-3">
        <Label>High-Need Positions (ranked by priority)</Label>
        <p className="text-xs text-muted-foreground">
          Click positions in order of priority. First click = highest need.
        </p>
        <div className="flex flex-wrap gap-2">
          {POSITIONS.map((pos) => {
            const entry = data.high_need_positions.find(
              (p) => p.position === pos
            );
            return (
              <Badge
                key={pos}
                variant={entry ? "default" : "outline"}
                className="cursor-pointer text-sm px-3 py-1"
                onClick={() =>
                  entry
                    ? removeHighNeedPosition(pos)
                    : addHighNeedPosition(pos)
                }
              >
                {entry && (
                  <span className="mr-1 font-bold">#{entry.rank}</span>
                )}
                {pos}
              </Badge>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <Label>Priority Graduation Years (ranked)</Label>
        <p className="text-xs text-muted-foreground">
          Click years in order of priority. First click = highest priority.
        </p>
        <div className="flex flex-wrap gap-2">
          {GRAD_YEARS.map((year) => {
            const entry = data.priority_grad_years.find(
              (y) => y.year === year
            );
            return (
              <Badge
                key={year}
                variant={entry ? "default" : "outline"}
                className="cursor-pointer text-sm px-3 py-1"
                onClick={() =>
                  entry
                    ? removePriorityGradYear(year)
                    : addPriorityGradYear(year)
                }
              >
                {entry && (
                  <span className="mr-1 font-bold">#{entry.rank}</span>
                )}
                {year}
              </Badge>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <Label>Roster Spots Available (per graduation year)</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {GRAD_YEARS.map((year) => (
            <div key={year} className="space-y-1">
              <Label className="text-xs">Class of {year}</Label>
              <Input
                type="number"
                min="0"
                max="30"
                placeholder="0"
                value={data.roster_spots[String(year)] ?? ""}
                onChange={(e) =>
                  updateRosterSpots(String(year), e.target.value)
                }
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { POSITIONS, GRAD_YEARS } from "@/types/config";
import type { RosterContextFormData } from "@/types/config";
import { ChevronDown } from "lucide-react";

interface RosterContextFormProps {
  data: RosterContextFormData;
  onChange: (data: RosterContextFormData) => void;
}

export function RosterContextForm({ data, onChange }: RosterContextFormProps) {
  const [openYears, setOpenYears] = useState<Record<string, boolean>>({});

  function toggleYear(year: string) {
    setOpenYears((prev) => ({ ...prev, [year]: !prev[year] }));
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

  function addHighNeedPosition(year: string, position: string) {
    const yearPositions = data.high_need_positions[year] || [];
    if (yearPositions.some((p) => p.position === position)) return;
    const rank = yearPositions.length + 1;
    onChange({
      ...data,
      high_need_positions: {
        ...data.high_need_positions,
        [year]: [...yearPositions, { position, rank }],
      },
    });
  }

  function removeHighNeedPosition(year: string, position: string) {
    const yearPositions = data.high_need_positions[year] || [];
    const filtered = yearPositions
      .filter((p) => p.position !== position)
      .map((p, i) => ({ ...p, rank: i + 1 }));
    onChange({
      ...data,
      high_need_positions: {
        ...data.high_need_positions,
        [year]: filtered,
      },
    });
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
        <Label>Position Needs & Roster Spots (per class year)</Label>
        <p className="text-xs text-muted-foreground">
          Expand each year to set position priorities and available roster spots.
        </p>
        <div className="space-y-2">
          {GRAD_YEARS.map((year) => {
            const yearStr = String(year);
            const yearPositions = data.high_need_positions[yearStr] || [];
            const spots = data.roster_spots[yearStr];
            const isOpen = openYears[yearStr] ?? false;

            return (
              <Collapsible
                key={year}
                open={isOpen}
                onOpenChange={() => toggleYear(yearStr)}
              >
                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span>Class of {year}</span>
                    {yearPositions.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {yearPositions.length} position{yearPositions.length !== 1 ? "s" : ""}
                      </Badge>
                    )}
                    {spots != null && (
                      <Badge variant="outline" className="text-xs">
                        {spots} spot{spots !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border border-t-0 rounded-b-lg px-4 py-4 space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs">
                        High-Need Positions (click to rank)
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {POSITIONS.map((pos) => {
                          const entry = yearPositions.find(
                            (p) => p.position === pos
                          );
                          return (
                            <Badge
                              key={pos}
                              variant={entry ? "default" : "outline"}
                              className="cursor-pointer text-sm px-3 py-1"
                              onClick={() =>
                                entry
                                  ? removeHighNeedPosition(yearStr, pos)
                                  : addHighNeedPosition(yearStr, pos)
                              }
                            >
                              {entry && (
                                <span className="mr-1 font-bold">
                                  #{entry.rank}
                                </span>
                              )}
                              {pos}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                    <div className="space-y-1 max-w-[200px]">
                      <Label className="text-xs">Roster Spots Available</Label>
                      <Input
                        type="number"
                        min="0"
                        max="30"
                        placeholder="0"
                        value={data.roster_spots[yearStr] ?? ""}
                        onChange={(e) =>
                          updateRosterSpots(yearStr, e.target.value)
                        }
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </div>
    </div>
  );
}

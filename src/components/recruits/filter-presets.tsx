"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ListFilter } from "lucide-react";
import type { RecruitFilters } from "@/types/recruit";
import { DEFAULT_FILTERS } from "@/types/recruit";

interface FilterPresetsProps {
  onApply: (updates: Partial<RecruitFilters>) => void;
  onReset: () => void;
}

interface Preset {
  label: string;
  filters: Partial<RecruitFilters>;
}

const PRESETS: Preset[] = [
  {
    label: "Top Prospects",
    filters: {
      dqs_min: 70,
      has_video: true,
      flag_filter: "interested",
    },
  },
  {
    label: "Class of 2027",
    filters: { graduation_years: [2027] },
  },
  {
    label: "Class of 2028",
    filters: { graduation_years: [2028] },
  },
  {
    label: "Needs Review",
    filters: { needs_review: true },
  },
];

const POSITION_PRESETS: Preset[] = [
  {
    label: "Goalkeepers",
    filters: { positions: ["GK"] },
  },
  {
    label: "Defenders",
    filters: { positions: ["CB", "LB", "RB"] },
  },
  {
    label: "Midfielders",
    filters: { positions: ["CDM", "CM", "CAM", "LM", "RM"] },
  },
  {
    label: "Forwards",
    filters: { positions: ["LW", "RW", "ST", "CF"] },
  },
];

export function FilterPresets({ onApply, onReset }: FilterPresetsProps) {
  function applyPreset(preset: Preset) {
    // Reset first, then apply preset filters
    onReset();
    // Small delay to let reset propagate before applying new filters
    setTimeout(() => onApply(preset.filters), 0);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5">
          <ListFilter className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Presets</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {PRESETS.map((preset) => (
          <DropdownMenuItem
            key={preset.label}
            onClick={() => applyPreset(preset)}
          >
            {preset.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {POSITION_PRESETS.map((preset) => (
          <DropdownMenuItem
            key={preset.label}
            onClick={() => applyPreset(preset)}
          >
            {preset.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { POSITIONS, GRAD_YEARS } from "@/types/config";
import type { RecruitFilters } from "@/types/recruit";
import type { FlagType } from "@/types/database";
import { RecruitSearch } from "./recruit-search";
import {
  Calendar,
  Shirt,
  Flag,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Check,
} from "lucide-react";

interface RecruitFilterBarProps {
  // Search
  searchTerm: string;
  onSearchChange: (value: string) => void;
  // Quick filters
  filters: RecruitFilters;
  onFiltersChange: (updates: Partial<RecruitFilters>) => void;
  // Sidebar toggle
  showFilters: boolean;
  onToggleFilters: () => void;
  activeFilterCount: number;
  // View mode
  viewMode: "cards" | "list";
  onViewModeChange: (mode: "cards" | "list") => void;
}

const FLAG_OPTIONS: { value: FlagType | "all"; label: string }[] = [
  { value: "all", label: "All Recruits" },
  { value: "interested", label: "Starred" },
  { value: "not_a_fit", label: "Not a Fit" },
];

export function RecruitFilterBar({
  searchTerm,
  onSearchChange,
  filters,
  onFiltersChange,
  showFilters,
  onToggleFilters,
  activeFilterCount,
  viewMode,
  onViewModeChange,
}: RecruitFilterBarProps) {
  function toggleGradYear(year: number) {
    const current = filters.graduation_years;
    const updated = current.includes(year)
      ? current.filter((y) => y !== year)
      : [...current, year];
    onFiltersChange({ graduation_years: updated });
  }

  function togglePosition(pos: string) {
    const current = filters.positions;
    const updated = current.includes(pos)
      ? current.filter((p) => p !== pos)
      : [...current, pos];
    onFiltersChange({ positions: updated });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Search */}
      <RecruitSearch value={searchTerm} onChange={onSearchChange} />

      {/* Quick filter: Graduation Year */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Year
            {filters.graduation_years.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1 text-[10px]">
                {filters.graduation_years.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Graduation Year
          </p>
          <div className="flex flex-wrap gap-1.5">
            {GRAD_YEARS.map((year) => (
              <Badge
                key={year}
                variant={
                  filters.graduation_years.includes(year) ? "default" : "outline"
                }
                className="cursor-pointer text-xs"
                onClick={() => toggleGradYear(year)}
              >
                {year}
              </Badge>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Quick filter: Position */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-1.5">
            <Shirt className="h-3.5 w-3.5" />
            Position
            {filters.positions.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1 text-[10px]">
                {filters.positions.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Position
          </p>
          <div className="flex flex-wrap gap-1.5 max-w-[280px]">
            {POSITIONS.map((pos) => (
              <Badge
                key={pos}
                variant={
                  filters.positions.includes(pos) ? "default" : "outline"
                }
                className="cursor-pointer text-xs"
                onClick={() => togglePosition(pos)}
              >
                {pos}
              </Badge>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Quick filter: Flag */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-1.5">
            <Flag className="h-3.5 w-3.5" />
            Flag
            {filters.flag_filter !== "all" && (
              <span className="ml-1 h-2 w-2 rounded-full bg-primary" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-48 p-2">
          <div className="space-y-0.5">
            {FLAG_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => onFiltersChange({ flag_filter: option.value })}
                className={`flex items-center justify-between w-full px-2.5 py-1.5 text-sm rounded-md transition-colors ${
                  filters.flag_filter === option.value
                    ? "bg-secondary font-medium"
                    : "hover:bg-muted"
                }`}
              >
                {option.label}
                {filters.flag_filter === option.value && (
                  <Check className="h-3.5 w-3.5" />
                )}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Advanced Filters sidebar toggle */}
      <Button
        variant="outline"
        size="sm"
        className="h-9"
        onClick={onToggleFilters}
      >
        <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
        Filters
        {activeFilterCount > 0 && (
          <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 px-1 text-[10px]">
            {activeFilterCount}
          </Badge>
        )}
      </Button>

      {/* View mode toggle */}
      <div className="flex items-center border rounded-md">
        <Button
          variant={viewMode === "cards" ? "secondary" : "ghost"}
          size="sm"
          className="h-8 px-2.5 rounded-r-none"
          onClick={() => onViewModeChange("cards")}
          title="Card view"
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
        <Button
          variant={viewMode === "list" ? "secondary" : "ghost"}
          size="sm"
          className="h-8 px-2.5 rounded-l-none"
          onClick={() => onViewModeChange("list")}
          title="List view"
        >
          <List className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

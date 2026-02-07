"use client";

import { useState, useMemo } from "react";
import { useRecruits } from "@/hooks/use-recruits";
import { RecruitCard } from "@/components/recruits/recruit-card";
import { RecruitFilterPanel } from "@/components/recruits/recruit-filters";
import type { RecruitFilters } from "@/types/recruit";
import { DEFAULT_FILTERS } from "@/types/recruit";
import type { RecruitWithScore } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SlidersHorizontal, X } from "lucide-react";

function applyFilters(
  recruits: RecruitWithScore[],
  filters: RecruitFilters
): RecruitWithScore[] {
  return recruits.filter((r) => {
    const dqs = r.dqs_score;

    // Hide not qualified by default
    if (!filters.show_not_qualified && dqs && !dqs.is_qualified) {
      return false;
    }

    // Hide "not a fit" flagged unless filtering for them
    if (
      filters.flag_filter !== "all" &&
      filters.flag_filter !== "none" &&
      r.flag?.flag !== filters.flag_filter
    ) {
      return false;
    }
    if (filters.flag_filter === "none" && r.flag) {
      return false;
    }

    // Graduation year filter
    if (
      filters.graduation_years.length > 0 &&
      r.graduation_year != null &&
      !filters.graduation_years.includes(r.graduation_year)
    ) {
      return false;
    }

    // Position filter
    if (filters.positions.length > 0) {
      if (!r.positions.some((p) => filters.positions.includes(p))) {
        return false;
      }
    }

    // Numeric filters
    if (filters.min_gpa != null && r.gpa != null && r.gpa < filters.min_gpa) {
      return false;
    }
    if (
      filters.min_height != null &&
      r.height_inches != null &&
      r.height_inches < filters.min_height
    ) {
      return false;
    }
    if (
      filters.min_sat != null &&
      r.sat_score != null &&
      r.sat_score < filters.min_sat
    ) {
      return false;
    }
    if (
      filters.min_act != null &&
      r.act_score != null &&
      r.act_score < filters.min_act
    ) {
      return false;
    }

    // Club level filter
    if (
      filters.club_levels.length > 0 &&
      !filters.club_levels.includes(r.club_level)
    ) {
      return false;
    }

    // Location filter
    if (filters.location) {
      const loc = filters.location.toLowerCase();
      const match =
        r.city?.toLowerCase().includes(loc) ||
        r.state?.toLowerCase().includes(loc) ||
        r.country?.toLowerCase().includes(loc);
      if (!match) return false;
    }

    // Has video filter
    if (filters.has_video && !r.video_url) {
      return false;
    }

    // DQS range
    if (dqs?.overall_score != null) {
      if (dqs.overall_score < filters.dqs_min || dqs.overall_score > filters.dqs_max) {
        return false;
      }
    }

    // Completeness filter
    if (filters.completeness_min > 0) {
      const pct =
        r.fields_total > 0 ? (r.fields_extracted / r.fields_total) * 100 : 0;
      if (pct < filters.completeness_min) return false;
    }

    // Needs review filter
    if (filters.needs_review) {
      const hasLow = Object.values(r.extraction_confidence).some(
        (c) => c === "low"
      );
      if (!hasLow) return false;
    }

    return true;
  });
}

export default function DashboardPage() {
  const { recruits, loading } = useRecruits();
  const [filters, setFilters] = useState<RecruitFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  const filteredRecruits = useMemo(
    () => applyFilters(recruits, filters),
    [recruits, filters]
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.graduation_years.length > 0) count++;
    if (filters.positions.length > 0) count++;
    if (filters.min_gpa != null) count++;
    if (filters.min_height != null) count++;
    if (filters.min_sat != null) count++;
    if (filters.min_act != null) count++;
    if (filters.club_levels.length > 0) count++;
    if (filters.location) count++;
    if (filters.has_video) count++;
    if (filters.dqs_min > 0 || filters.dqs_max < 100) count++;
    if (filters.show_not_qualified) count++;
    if (filters.needs_review) count++;
    return count;
  }, [filters]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Recruit Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {filteredRecruits.length} of {recruits.length} recruits
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal className="h-4 w-4 mr-2" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </div>

      <div className="flex gap-6">
        {/* Filter panel */}
        {showFilters && (
          <div className="w-72 shrink-0">
            <RecruitFilterPanel filters={filters} onChange={setFilters} />
          </div>
        )}

        {/* Recruit grid */}
        <div className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Loading recruits...</p>
            </div>
          ) : filteredRecruits.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <p className="text-muted-foreground mb-2">
                {recruits.length === 0
                  ? "No recruits yet. Emails ingested through Zapier will appear here."
                  : "No recruits match your filters."}
              </p>
              {activeFilterCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredRecruits.map((recruit) => (
                <RecruitCard key={recruit.id} recruit={recruit} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

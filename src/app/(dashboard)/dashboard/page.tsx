"use client";

import { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRecruits } from "@/hooks/use-recruits";
import { useDashboardParams } from "@/hooks/use-dashboard-params";
import { RecruitCard } from "@/components/recruits/recruit-card";
import { RecruitFilterPanel } from "@/components/recruits/recruit-filters";
import { RecruitListView } from "@/components/recruits/recruit-list-view";
import { RecruitFilterBar } from "@/components/recruits/recruit-filter-bar";
import { ActiveFilterChips } from "@/components/recruits/active-filter-chips";
import { BulkEmailDialog } from "@/components/email/bulk-email-dialog";
import { ExportDialog } from "@/components/recruits/export-dialog";
import type { RecruitFilters, SortOption, SortDirection } from "@/types/recruit";
import { DEFAULT_SORT_DIRECTIONS } from "@/types/recruit";
import type { RecruitWithScore } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Mail, Trash2, X, Download } from "lucide-react";

function applyFilters(
  recruits: RecruitWithScore[],
  filters: RecruitFilters,
  searchTerm: string
): RecruitWithScore[] {
  return recruits.filter((r) => {
    // Multi-field search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const searchFields = [
        r.full_name,
        r.email,
        r.club_team,
        r.current_school,
        r.city,
        r.state,
        r.high_school_team,
      ];
      if (!searchFields.some((f) => f?.toLowerCase().includes(term))) {
        return false;
      }
    }

    const dqs = r.dqs_score;

    // Hide not qualified by default
    if (!filters.show_not_qualified && dqs && !dqs.is_qualified) {
      return false;
    }

    // Flag filter
    if (
      filters.flag_filter !== "all" &&
      r.flag?.flag !== filters.flag_filter
    ) {
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
      if (
        dqs.overall_score < filters.dqs_min ||
        dqs.overall_score > filters.dqs_max
      ) {
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

function applySorting(
  recruits: RecruitWithScore[],
  sortBy: SortOption,
  sortDir: SortDirection
): RecruitWithScore[] {
  const sorted = [...recruits];
  const dir = sortDir === "asc" ? 1 : -1;

  switch (sortBy) {
    case "name":
      sorted.sort(
        (a, b) =>
          dir * (a.full_name ?? "").localeCompare(b.full_name ?? "")
      );
      break;
    case "grad_year":
      sorted.sort(
        (a, b) =>
          dir *
          ((a.graduation_year ?? 9999) - (b.graduation_year ?? 9999))
      );
      break;
    case "date":
      sorted.sort(
        (a, b) =>
          dir *
          (new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime())
      );
      break;
    case "gpa":
      sorted.sort(
        (a, b) => dir * ((a.gpa ?? -1) - (b.gpa ?? -1))
      );
      break;
    case "height":
      sorted.sort(
        (a, b) =>
          dir * ((a.height_inches ?? -1) - (b.height_inches ?? -1))
      );
      break;
    case "completeness": {
      sorted.sort((a, b) => {
        const compA =
          a.fields_total > 0 ? a.fields_extracted / a.fields_total : 0;
        const compB =
          b.fields_total > 0 ? b.fields_extracted / b.fields_total : 0;
        return dir * (compA - compB);
      });
      break;
    }
    default:
      // DQS score
      sorted.sort(
        (a, b) =>
          dir *
          ((a.dqs_score?.overall_score ?? -1) -
            (b.dqs_score?.overall_score ?? -1))
      );
      break;
  }
  return sorted;
}

/** Map filter keys to their default values for removing individual filters */
function getDefaultForKey(key: keyof RecruitFilters): Partial<RecruitFilters> {
  switch (key) {
    case "graduation_years":
      return { graduation_years: [] };
    case "positions":
      return { positions: [] };
    case "min_gpa":
      return { min_gpa: null };
    case "min_height":
      return { min_height: null };
    case "min_sat":
      return { min_sat: null };
    case "min_act":
      return { min_act: null };
    case "club_levels":
      return { club_levels: [] };
    case "location":
      return { location: "" };
    case "has_video":
      return { has_video: false };
    case "dqs_min":
      return { dqs_min: 0, dqs_max: 100 };
    case "dqs_max":
      return { dqs_min: 0, dqs_max: 100 };
    case "completeness_min":
      return { completeness_min: 0 };
    case "show_not_qualified":
      return { show_not_qualified: false };
    case "needs_review":
      return { needs_review: false };
    case "flag_filter":
      return { flag_filter: "all" };
  }
}

function DashboardContent() {
  const supabase = createClient();
  const { recruits, loading, refetch, updateRecruitFlag } = useRecruits();
  const [coachEmail, setCoachEmail] = useState<string | undefined>();
  const {
    searchTerm,
    setSearchTerm,
    sortBy,
    setSortBy,
    sortDir,
    setSortDir,
    filters,
    setFilters,
    resetFilters,
    activeFilterCount,
  } = useDashboardParams();

  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("q5r_view_mode");
    if (saved === "list") setViewMode("list");
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setCoachEmail(user.email);
    });
  }, [supabase]);

  function handleViewMode(mode: "cards" | "list") {
    setViewMode(mode);
    localStorage.setItem("q5r_view_mode", mode);
  }

  function handleSort(field: SortOption) {
    if (field === sortBy) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDir(DEFAULT_SORT_DIRECTIONS[field]);
    }
  }

  function handleRemoveFilter(key: keyof RecruitFilters) {
    setFilters(getDefaultForKey(key));
  }

  function handleClearAll() {
    resetFilters();
  }

  const filteredRecruits = useMemo(
    () => applyFilters(recruits, filters, searchTerm),
    [recruits, filters, searchTerm]
  );

  const sortedRecruits = useMemo(
    () => applySorting(filteredRecruits, sortBy, sortDir),
    [filteredRecruits, sortBy, sortDir]
  );

  const toggleSelect = useCallback((recruitId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(recruitId)) {
        next.delete(recruitId);
      } else {
        next.add(recruitId);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (sortedRecruits.every((r) => prev.has(r.id))) {
        return new Set();
      }
      return new Set(sortedRecruits.map((r) => r.id));
    });
  }, [sortedRecruits]);

  const selectedRecruits = useMemo(
    () => sortedRecruits.filter((r) => selectedIds.has(r.id)),
    [sortedRecruits, selectedIds]
  );

  async function handleBulkDelete() {
    setBulkDeleting(true);
    try {
      const res = await fetch("/api/recruits/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
        setBulkDeleteOpen(false);
        refetch();
      }
    } finally {
      setBulkDeleting(false);
    }
  }

  // Count only sidebar-relevant filters (exclude Year/Position/Flag which are in popovers)
  const sidebarFilterCount = useMemo(() => {
    let count = 0;
    if (filters.min_gpa != null) count++;
    if (filters.min_height != null) count++;
    if (filters.min_sat != null) count++;
    if (filters.min_act != null) count++;
    if (filters.club_levels.length > 0) count++;
    if (filters.location) count++;
    if (filters.has_video) count++;
    if (filters.dqs_min > 0 || filters.dqs_max < 100) count++;
    if (filters.completeness_min > 0) count++;
    if (filters.show_not_qualified) count++;
    if (filters.needs_review) count++;
    return count;
  }, [filters]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-baseline gap-3 mb-4">
          <h1 className="text-2xl font-bold">Recruits</h1>
          <p className="text-sm text-muted-foreground">
            {sortedRecruits.length} of {recruits.length} players
          </p>
        </div>

        {/* Controls row */}
        <RecruitFilterBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          filters={filters}
          onFiltersChange={setFilters}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(!showFilters)}
          activeFilterCount={sidebarFilterCount}
          viewMode={viewMode}
          onViewModeChange={handleViewMode}
        />

        {/* Active filter chips */}
        <div className="mt-3">
          <ActiveFilterChips
            filters={filters}
            searchTerm={searchTerm}
            onRemoveFilter={handleRemoveFilter}
            onClearSearch={() => setSearchTerm("")}
            onClearAll={handleClearAll}
          />
        </div>
      </div>

      {/* Selection toolbar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-2.5">
          <span className="text-sm font-medium">
            {selectedIds.size} recruit{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          <Button
            size="sm"
            onClick={() => setBulkEmailOpen(true)}
          >
            <Mail className="h-4 w-4 mr-1.5" />
            Email Selected
          </Button>
          <Button
            variant="destructive"
            size="icon"
            className="h-8 w-8"
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>
      )}

      {/* Export toolbar */}
      {recruits.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setExportOpen(true)}
          >
            <Download className="h-4 w-4 mr-1.5" />
            Export All Recruits
          </Button>
        </div>
      )}

      {/* Bulk email dialog */}
      <BulkEmailDialog
        open={bulkEmailOpen}
        onClose={() => {
          setBulkEmailOpen(false);
          setSelectedIds(new Set());
        }}
        selectedRecruits={selectedRecruits}
        coachEmail={coachEmail}
      />

      {/* Export dialog */}
      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        recruitCount={recruits.length}
      />

      {/* Bulk delete confirmation dialog */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} Recruit{selectedIds.size !== 1 ? "s" : ""}?</DialogTitle>
            <DialogDescription>
              This will permanently delete{" "}
              <span className="font-semibold text-foreground">
                {selectedIds.size} recruit{selectedIds.size !== 1 ? "s" : ""}
              </span>{" "}
              along with their profiles, scores, and all associated data.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkDeleteOpen(false)}
              disabled={bulkDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
            >
              {bulkDeleting ? "Deleting..." : `Delete ${selectedIds.size} Recruit${selectedIds.size !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex gap-6">
        {/* Sidebar filter panel */}
        {showFilters && (
          <div className="w-72 shrink-0">
            <RecruitFilterPanel
              filters={filters}
              onChange={setFilters}
              onReset={resetFilters}
              sortBy={sortBy}
              sortDir={sortDir}
              onSortChange={setSortBy}
              onSortDirChange={setSortDir}
            />
          </div>
        )}

        {/* Recruit grid */}
        <div className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Loading recruits...</p>
            </div>
          ) : sortedRecruits.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <p className="text-muted-foreground mb-2">
                {recruits.length === 0
                  ? "No recruits yet."
                  : searchTerm && activeFilterCount === 0
                  ? `No recruits match "${searchTerm}"`
                  : searchTerm
                  ? `No recruits match "${searchTerm}" with current filters`
                  : "No recruits match your filters."}
              </p>
              {(activeFilterCount > 0 || searchTerm) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearAll}
                >
                  Clear all filters
                </Button>
              )}
            </div>
          ) : viewMode === "cards" ? (
            <div>
              <div className="flex items-center gap-2 mb-3 px-1">
                <Checkbox
                  checked={
                    sortedRecruits.length > 0 &&
                    sortedRecruits.every((r) => selectedIds.has(r.id))
                  }
                  onCheckedChange={toggleSelectAll}
                />
                <span
                  className="text-sm text-muted-foreground cursor-pointer select-none"
                  onClick={toggleSelectAll}
                >
                  Select all ({sortedRecruits.length})
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {sortedRecruits.map((recruit) => (
                <RecruitCard
                  key={recruit.id}
                  recruit={recruit}
                  onFlagChange={updateRecruitFlag}
                  selected={selectedIds.has(recruit.id)}
                  onToggleSelect={toggleSelect}
                />
              ))}
              </div>
            </div>
          ) : (
            <RecruitListView
              recruits={sortedRecruits}
              sortBy={sortBy}
              sortDirection={sortDir}
              onSort={handleSort}
              onFlagChange={updateRecruitFlag}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}

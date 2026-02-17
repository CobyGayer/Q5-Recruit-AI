"use client";

import {
  useQueryState,
  parseAsArrayOf,
  parseAsInteger,
  parseAsFloat,
  parseAsStringEnum,
  parseAsBoolean,
  parseAsString,
} from "nuqs";
import { useCallback, useMemo } from "react";
import type { RecruitFilters } from "@/types/recruit";
import {
  DEFAULT_FILTERS,
  type SortOption,
  type SortDirection,
} from "@/types/recruit";
import type { FlagType } from "@/types/database";

const SORT_OPTIONS: string[] = [
  "dqs",
  "name",
  "grad_year",
  "date",
  "gpa",
  "height",
  "completeness",
];

const SORT_DIRECTIONS: string[] = ["asc", "desc"];

const FLAG_OPTIONS: string[] = ["all", "interested", "not_a_fit"];

export function useDashboardParams() {
  // Search
  const [searchTerm, setSearchTerm] = useQueryState(
    "q",
    parseAsString.withDefault("")
  );

  // Sort
  const [sortBy, setSortBy] = useQueryState(
    "sort",
    parseAsStringEnum(SORT_OPTIONS).withDefault("dqs")
  );
  const [sortDir, setSortDir] = useQueryState(
    "dir",
    parseAsStringEnum(SORT_DIRECTIONS).withDefault("desc")
  );

  // Array filters
  const [positions, setPositions] = useQueryState(
    "pos",
    parseAsArrayOf(parseAsString, ",").withDefault([])
  );
  const [gradYears, setGradYears] = useQueryState(
    "yr",
    parseAsArrayOf(parseAsInteger, ",").withDefault([])
  );
  const [clubLevels, setClubLevels] = useQueryState(
    "club",
    parseAsArrayOf(parseAsString, ",").withDefault([])
  );

  // Numeric filters
  const [minGpa, setMinGpa] = useQueryState("gpa_min", parseAsFloat);
  const [minHeight, setMinHeight] = useQueryState("ht", parseAsInteger);
  const [minSat, setMinSat] = useQueryState("sat", parseAsInteger);
  const [minAct, setMinAct] = useQueryState("act", parseAsInteger);
  const [dqsMin, setDqsMin] = useQueryState(
    "dqs_min",
    parseAsInteger.withDefault(0)
  );
  const [dqsMax, setDqsMax] = useQueryState(
    "dqs_max",
    parseAsInteger.withDefault(100)
  );
  const [completenessMin, setCompletenessMin] = useQueryState(
    "comp",
    parseAsInteger.withDefault(0)
  );

  // String filters
  const [location, setLocation] = useQueryState(
    "loc",
    parseAsString.withDefault("")
  );
  const [flagFilter, setFlagFilter] = useQueryState(
    "flag",
    parseAsStringEnum(FLAG_OPTIONS).withDefault("all")
  );

  // Boolean filters
  const [hasVideo, setHasVideo] = useQueryState(
    "video",
    parseAsBoolean.withDefault(false)
  );
  const [showNotQualified, setShowNotQualified] = useQueryState(
    "nq",
    parseAsBoolean.withDefault(false)
  );
  const [needsReview, setNeedsReview] = useQueryState(
    "review",
    parseAsBoolean.withDefault(false)
  );

  // Assemble filters object
  const filters: RecruitFilters = useMemo(
    () => ({
      graduation_years: gradYears,
      positions,
      min_gpa: minGpa,
      min_height: minHeight,
      min_sat: minSat,
      min_act: minAct,
      club_levels: clubLevels,
      location,
      has_video: hasVideo,
      dqs_min: dqsMin,
      dqs_max: dqsMax,
      completeness_min: completenessMin,
      show_not_qualified: showNotQualified,
      needs_review: needsReview,
      flag_filter: flagFilter as FlagType | "all",
    }),
    [
      gradYears,
      positions,
      minGpa,
      minHeight,
      minSat,
      minAct,
      clubLevels,
      location,
      hasVideo,
      dqsMin,
      dqsMax,
      completenessMin,
      showNotQualified,
      needsReview,
      flagFilter,
    ]
  );

  // Partial filter updater
  const setFilters = useCallback(
    (updates: Partial<RecruitFilters>) => {
      if ("graduation_years" in updates)
        setGradYears(updates.graduation_years!.length > 0 ? updates.graduation_years! : null);
      if ("positions" in updates)
        setPositions(updates.positions!.length > 0 ? updates.positions! : null);
      if ("min_gpa" in updates) setMinGpa(updates.min_gpa ?? null);
      if ("min_height" in updates) setMinHeight(updates.min_height ?? null);
      if ("min_sat" in updates) setMinSat(updates.min_sat ?? null);
      if ("min_act" in updates) setMinAct(updates.min_act ?? null);
      if ("club_levels" in updates)
        setClubLevels(updates.club_levels!.length > 0 ? updates.club_levels! : null);
      if ("location" in updates)
        setLocation(updates.location || null);
      if ("has_video" in updates)
        setHasVideo(updates.has_video || null);
      if ("dqs_min" in updates) setDqsMin(updates.dqs_min === 0 ? null : updates.dqs_min!);
      if ("dqs_max" in updates) setDqsMax(updates.dqs_max === 100 ? null : updates.dqs_max!);
      if ("completeness_min" in updates)
        setCompletenessMin(updates.completeness_min === 0 ? null : updates.completeness_min!);
      if ("show_not_qualified" in updates)
        setShowNotQualified(updates.show_not_qualified || null);
      if ("needs_review" in updates)
        setNeedsReview(updates.needs_review || null);
      if ("flag_filter" in updates)
        setFlagFilter(updates.flag_filter === "all" ? null : updates.flag_filter!);
    },
    [
      setGradYears,
      setPositions,
      setMinGpa,
      setMinHeight,
      setMinSat,
      setMinAct,
      setClubLevels,
      setLocation,
      setHasVideo,
      setDqsMin,
      setDqsMax,
      setCompletenessMin,
      setShowNotQualified,
      setNeedsReview,
      setFlagFilter,
    ]
  );

  const resetFilters = useCallback(() => {
    setSearchTerm(null);
    setGradYears(null);
    setPositions(null);
    setMinGpa(null);
    setMinHeight(null);
    setMinSat(null);
    setMinAct(null);
    setClubLevels(null);
    setLocation(null);
    setHasVideo(null);
    setDqsMin(null);
    setDqsMax(null);
    setCompletenessMin(null);
    setShowNotQualified(null);
    setNeedsReview(null);
    setFlagFilter(null);
  }, [
    setSearchTerm,
    setGradYears,
    setPositions,
    setMinGpa,
    setMinHeight,
    setMinSat,
    setMinAct,
    setClubLevels,
    setLocation,
    setHasVideo,
    setDqsMin,
    setDqsMax,
    setCompletenessMin,
    setShowNotQualified,
    setNeedsReview,
    setFlagFilter,
  ]);

  // Count active (non-default) filters
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
    if (filters.completeness_min > 0) count++;
    if (filters.show_not_qualified) count++;
    if (filters.needs_review) count++;
    if (filters.flag_filter !== "all") count++;
    return count;
  }, [filters]);

  return {
    // Search
    searchTerm,
    setSearchTerm,
    // Sort
    sortBy: sortBy as SortOption,
    setSortBy,
    sortDir: sortDir as SortDirection,
    setSortDir,
    // Filters
    filters,
    setFilters,
    resetFilters,
    activeFilterCount,
    // Individual setters for popover components
    setGradYears,
    setPositions,
    setFlagFilter,
  };
}

import type { FlagType, ProcessingStatus } from "./database";

/** Filters for the recruit dashboard */
export interface RecruitFilters {
  graduation_years: number[];
  positions: string[];
  min_gpa: number | null;
  min_height: number | null;
  min_sat: number | null;
  min_act: number | null;
  club_levels: string[];
  location: string;
  has_video: boolean;
  dqs_min: number;
  dqs_max: number;
  completeness_min: number;
  show_not_qualified: boolean;
  needs_review: boolean;
  flag_filter: FlagType | "none" | "all";
}

/** Default filter values */
export const DEFAULT_FILTERS: RecruitFilters = {
  graduation_years: [],
  positions: [],
  min_gpa: null,
  min_height: null,
  min_sat: null,
  min_act: null,
  club_levels: [],
  location: "",
  has_video: false,
  dqs_min: 0,
  dqs_max: 100,
  completeness_min: 0,
  show_not_qualified: false,
  needs_review: false,
  flag_filter: "all",
};

/** Queue item for the ingestion queue view */
export interface QueueItem {
  id: string;
  sender_email: string | null;
  sender_name: string | null;
  subject: string | null;
  received_at: string | null;
  processing_status: ProcessingStatus;
  recruit_id: string | null;
  extraction_error: string | null;
  created_at: string;
}

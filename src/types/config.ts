import type { HeightRange } from "@/types/database";

export const FOOT_OPTIONS = ["Either", "Right", "Left"] as const;
export type PreferredFoot = typeof FOOT_OPTIONS[number];

/** Form data for onboarding threshold step */
export interface ThresholdFormData {
  min_gpa: number | null;
  min_sat: number | null;
  min_act: number | null;
  min_height_by_position: Record<string, number>;
  accepted_grad_years: number[];
  accepted_positions: string[];
  preferred_foot_by_position: Record<string, PreferredFoot>;
  preferred_height_range_by_position: Record<string, HeightRange>;
}

/** Form data for onboarding weight step (0-100 sliders) */
export interface WeightFormData {
  weight_academic: number;
  weight_competition: number;
  weight_physical: number;
  weight_position_fit: number;
  weight_grad_year: number;
  weight_completeness: number;
}

/** Form data for roster context step */
export interface RosterContextFormData {
  high_need_positions: Record<string, Array<{ position: string; rank: number }>>;
  priority_grad_years: Array<{ year: number; rank: number }>;
  roster_spots: Record<string, number>;
}

/** Combined config form data */
export interface ConfigFormData
  extends ThresholdFormData,
    WeightFormData,
    RosterContextFormData {}

/** Available soccer positions */
export const POSITIONS = [
  "GK",
  "CB",
  "LB",
  "RB",
  "CDM",
  "CM",
  "CAM",
  "LM",
  "RM",
  "LW",
  "RW",
  "ST",
  "CF",
] as const;

/** Available graduation years for filtering */
export const GRAD_YEARS = [2025, 2026, 2027, 2028, 2029, 2030] as const;

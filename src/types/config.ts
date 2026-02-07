import type { PriorityTier } from "./database";

/** Form data for onboarding threshold step */
export interface ThresholdFormData {
  min_gpa: number | null;
  min_sat: number | null;
  min_act: number | null;
  min_height_by_position: Record<string, number>;
  accepted_grad_years: number[];
  accepted_positions: string[];
}

/** Form data for onboarding weight step */
export interface WeightFormData {
  weight_academic: PriorityTier;
  weight_competition: PriorityTier;
  weight_physical: PriorityTier;
  weight_position_fit: PriorityTier;
  weight_grad_year: PriorityTier;
  weight_completeness: PriorityTier;
}

/** Form data for roster context step */
export interface RosterContextFormData {
  high_need_positions: Array<{ position: string; rank: number }>;
  priority_grad_years: Array<{ year: number; rank: number }>;
  roster_spots: Record<string, number>;
}

/** Combined config form data */
export interface ConfigFormData
  extends ThresholdFormData,
    WeightFormData,
    RosterContextFormData {}

/** Tier weight numeric values */
export const TIER_WEIGHTS: Record<PriorityTier, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

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

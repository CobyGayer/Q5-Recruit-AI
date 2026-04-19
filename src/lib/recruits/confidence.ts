import type { ConfidenceLevel } from "@/types/database";

export const CONFIDENCE_RANK: Record<ConfidenceLevel, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

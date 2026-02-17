/**
 * Unified DQS color scale — 5 tiers with consistent breakpoints
 * used by both the badge and the per-component breakdown bars.
 *
 *   85+  → emerald  (excellent)
 *   70–84 → primary  (good)
 *   55–69 → amber    (average)
 *   40–54 → orange   (below average)
 *   <40  → rose     (poor)
 */

/** Badge backgrounds (bg + text for contrast) */
export function getScoreBadgeClass(score: number): string {
  if (score >= 85) return "bg-emerald-600 text-white";
  if (score >= 70) return "bg-primary text-primary-foreground";
  if (score >= 55) return "bg-amber-500 text-white";
  if (score >= 40) return "bg-orange-500 text-white";
  return "bg-rose-500 text-white";
}

/** Progress-bar fills */
export function getScoreBarClass(score: number): string {
  if (score >= 85) return "bg-emerald-600";
  if (score >= 70) return "bg-primary";
  if (score >= 55) return "bg-amber-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-rose-500";
}

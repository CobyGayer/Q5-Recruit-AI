import type { ClubLevel, Recruit, ProgramConfig } from "@/types/database";
import { isLeagueSelected } from "@/lib/data/leagues";
import { getLeagueLabel } from "@/lib/data/leagues";

/**
 * Determines if a recruit's club should be marked as "outside selected leagues"
 * This is called during profile creation and when updating club_level or league preferences
 *
 * @param clubLevel The recruit's assigned club level
 * @param leaguePreferences The coach's selected leagues
 * @returns true if the club level is NOT in the selected leagues
 */
export function shouldMarkOutsideSelection(
  clubLevel: ClubLevel,
  leaguePreferences: ClubLevel[]
): boolean {
  return !isLeagueSelected(clubLevel, leaguePreferences);
}

/**
 * Updates the flag for a recruit based on their club level and league preferences
 * Used after league preferences change to batch-update all recruits in a program
 *
 * @param recruit The recruit to evaluate
 * @param leaguePreferences The program's current league preferences
 * @returns true if the flag changed, false otherwise
 */
export function evaluateOutsideSelectionFlag(
  recruit: Recruit,
  leaguePreferences: ClubLevel[]
): { flagValue: boolean; changed: boolean } {
  const newFlagValue = shouldMarkOutsideSelection(recruit.club_level, leaguePreferences);
  const changed = recruit.is_outside_selected_leagues !== newFlagValue;

  return { flagValue: newFlagValue, changed };
}

/**
 * Batch evaluate all recruits in a program when league preferences change
 * Returns which recruits need updates
 */
export function batchEvaluateOutsideSelectionFlags(
  recruits: Recruit[],
  leaguePreferences: ClubLevel[]
): Array<{ recruitId: string; newFlagValue: boolean }> {
  return recruits
    .map((recruit) => {
      const { flagValue, changed } = evaluateOutsideSelectionFlag(recruit, leaguePreferences);
      return { recruitId: recruit.id, newFlagValue: flagValue, changed };
    })
    .filter((item) => item.changed)
    .map(({ recruitId, newFlagValue }) => ({ recruitId, newFlagValue }));
}

/**
 * Display label for a recruit's league
 * If the recruit is flagged as outside selected leagues, show "Unknown"
 * Otherwise show their actual club level
 */
export function getDisplayLeagueLabel(recruit: Recruit): string {
  return getLeagueLabel(getDisplayLeagueId(recruit));
}

/**
 * Canonical display league for filtering and rendering.
 * Outside-selection recruits are surfaced as the `unknown` bucket.
 */
export function getDisplayLeagueId(recruit: Recruit): ClubLevel {
  if (recruit.is_outside_selected_leagues) {
    return "unknown";
  }
  return recruit.club_level;
}

/**
 * Detailed league info for display/tooltips
 * Shows both the display label and the underlying actual league
 */
export function getDetailedLeagueInfo(recruit: Recruit): {
  displayLabel: string;
  actualClubLevel: ClubLevel;
  isOutsideSelection: boolean;
} {
  return {
    displayLabel: getDisplayLeagueLabel(recruit),
    actualClubLevel: recruit.club_level,
    isOutsideSelection: recruit.is_outside_selected_leagues,
  };
}

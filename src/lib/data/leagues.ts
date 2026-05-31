import type { ClubLevel } from "@/types/database";

/**
 * League Definition - Centralized source of truth for all league tiers
 * Easily extendable for adding more leagues in the future
 */
export interface LeagueDefinition {
  id: ClubLevel;
  name: string;
  displayLabel: string;
  defaultRating: number; // 0-10 scale
}

const GA_ASPIRE_LEAGUE: LeagueDefinition = {
  id: "ga_aspire",
  name: "GA Aspire",
  displayLabel: "GA Aspire",
  defaultRating: 7,
};

const ECRL_LEAGUE: LeagueDefinition = {
  id: "ecrl",
  name: "ECRL",
  displayLabel: "ECRL",
  defaultRating: 8.5,
};

const MLS_NEXT_HOMEGROWN_LEAGUE: LeagueDefinition = {
  id: "mls_next_homegrown",
  name: "MLS Next - Homegrown",
  displayLabel: "MLS Next - Homegrown",
  defaultRating: 10,
};

const MLS_NEXT_ACADEMY_LEAGUE: LeagueDefinition = {
  id: "mls_next_academy",
  name: "MLS Next - Academy",
  displayLabel: "MLS Next - Academy",
  defaultRating: 9,
};

/** Centralized league tier definitions */
export const LEAGUE_TIERS: LeagueDefinition[] = [
  {
    id: "mls_next",
    name: "MLS NEXT",
    displayLabel: "MLS NEXT",
    defaultRating: 10,
  },
  MLS_NEXT_HOMEGROWN_LEAGUE,
  MLS_NEXT_ACADEMY_LEAGUE,
  {
    id: "ecnl",
    name: "ECNL",
    displayLabel: "ECNL",
    defaultRating: 9,
  },
  ECRL_LEAGUE,
  {
    id: "ga",
    name: "GA",
    displayLabel: "Girls Academy",
    defaultRating: 7.5,
  },
  GA_ASPIRE_LEAGUE,
  {
    id: "nal",
    name: "NAL",
    displayLabel: "NAL",
    defaultRating: 5.5,
  },
  {
    id: "dpl",
    name: "DPL",
    displayLabel: "DPL",
    defaultRating: 5.5,
  },
  {
    id: "other",
    name: "Other",
    displayLabel: "Other",
    defaultRating: 3.5,
  },
  {
    id: "unknown",
    name: "Unknown",
    displayLabel: "Unknown",
    defaultRating: 5,
  },
];

const SUBLEAGUE_IDS: ClubLevel[] = [
  "mls_next_homegrown",
  "mls_next_academy",
  "ga_aspire",
  "ecrl",
];

export const SELECTABLE_LEAGUE_TIERS = LEAGUE_TIERS.filter(
  (league) => !SUBLEAGUE_IDS.includes(league.id)
);

/** Type for league preferences (array of selected league IDs) */
export type LeaguePreferences = ClubLevel[];

/** Type for league ratings (object mapping league ID to 0-10 rating) */
export type LeagueRatings = Record<ClubLevel, number>;

/**
 * Get a league definition by ID
 */
export function getLeagueDefinition(leagueId: ClubLevel): LeagueDefinition | null {
  if (leagueId === "ga_aspire") {
    return GA_ASPIRE_LEAGUE;
  }

  if (leagueId === "ecrl") {
    return ECRL_LEAGUE;
  }

  return LEAGUE_TIERS.find((league) => league.id === leagueId) ?? null;
}

/**
 * Get display label for a league
 */
export function getLeagueLabel(leagueId: ClubLevel): string {
  const league = getLeagueDefinition(leagueId);
  return league?.displayLabel ?? "Unknown";
}

/**
 * Check if a league is in the coach's selected preferences
 */
export function isLeagueSelected(
  leagueId: ClubLevel,
  preferences: LeaguePreferences
): boolean {
  if (SUBLEAGUE_IDS.includes(leagueId)) {
    if (leagueId === "ga_aspire") {
      return preferences.includes("ga");
    }

    if (leagueId === "mls_next_homegrown" || leagueId === "mls_next_academy") {
      return preferences.includes("mls_next");
    }

    if (leagueId === "ecrl") {
      return preferences.includes("ecnl");
    }
  }

  return preferences.includes(leagueId);
}

/**
 * Get the rating for a league
 * Returns the rating if set, or defaults to 5 (neutral) if not found
 */
export function getLeagueRating(
  leagueId: ClubLevel,
  ratings: LeagueRatings
): number {
  const league = getLeagueDefinition(leagueId);
  return ratings[leagueId] ?? league?.defaultRating ?? 5;
}

/**
 * Create default league ratings based on tier definitions
 */
export function createDefaultLeagueRatings(): LeagueRatings {
  const ratings: Partial<LeagueRatings> = {};
  for (const league of LEAGUE_TIERS) {
    ratings[league.id] = league.defaultRating;
  }
  return ratings as LeagueRatings;
}

/**
 * Create default league preferences (all leagues selected)
 */
export function createDefaultLeaguePreferences(): LeaguePreferences {
  return SELECTABLE_LEAGUE_TIERS.map((league) => league.id);
}

/**
 * Validate that ratings are within 0-10 range
 */
export function validateLeagueRatings(ratings: LeagueRatings): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  for (const [leagueId, rating] of Object.entries(ratings)) {
    if (typeof rating !== "number") {
      errors.push(`Rating for ${leagueId} must be a number`);
    } else if (rating < 0 || rating > 10) {
      errors.push(`Rating for ${leagueId} must be between 0 and 10`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate that all selected league preferences exist in the tier definitions
 */
export function validateLeaguePreferences(preferences: LeaguePreferences): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const validIds = new Set(SELECTABLE_LEAGUE_TIERS.map((l) => l.id));

  for (const pref of preferences) {
    if (!validIds.has(pref)) {
      errors.push(`Unknown league ID: ${pref}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

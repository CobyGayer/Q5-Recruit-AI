import { describe, it, expect } from "vitest";
import {
  isLeagueSelected,
  getLeagueRating,
  createDefaultLeagueRatings,
  validateLeaguePreferences,
} from "@/lib/data/leagues";

describe("MLS Next Sublevels", () => {
  it("sublevels are selected when mls_next is in preferences", () => {
    const prefs = ["mls_next"] as any;
    expect(isLeagueSelected("mls_next_homegrown", prefs)).toBe(true);
    expect(isLeagueSelected("mls_next_academy", prefs)).toBe(true);
  });

  it("getLeagueRating returns mls_next rating for sublevels", () => {
    const ratings: any = { mls_next: 8 };
    expect(getLeagueRating("mls_next_homegrown", ratings)).toBe(8);
    expect(getLeagueRating("mls_next_academy", ratings)).toBe(8);

    // missing ratings should default to 5
    expect(getLeagueRating("mls_next_homegrown", {} as any)).toBe(5);
  });

  it("createDefaultLeagueRatings includes the new sublevels with expected defaults", () => {
    const defaults = createDefaultLeagueRatings();
    expect(defaults.mls_next_homegrown).toBeDefined();
    expect(defaults.mls_next_academy).toBeDefined();
  });

  it("validateLeaguePreferences accepts sublevel ids", () => {
    const result = validateLeaguePreferences(["mls_next_homegrown", "mls_next_academy"] as any);
    expect(result.valid).toBe(true);
  });
});

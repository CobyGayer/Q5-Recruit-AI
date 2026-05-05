import { describe, expect, it } from "vitest";
import { calculateDQS } from "@/lib/scoring/dqs";
import type { ProgramConfig, Recruit } from "@/types/database";

function makeRecruit(overrides: Partial<Recruit> = {}): Recruit {
  return {
    id: "recruit-1",
    coach_id: "coach-1",
    program_id: "program-1",
    email: "player@example.com",
    full_name: "Player One",
    name_key: "playerone",
    phone: null,
    graduation_year: 2027,
    current_school: null,
    city: null,
    state: null,
    country: "USA",
    positions: ["CB"],
    preferred_foot: null,
    height_inches: null,
    weight_lbs: null,
    gpa: 4.0,
    sat_score: null,
    act_score: null,
    club_team: null,
    club_level: "unknown",
    high_school_team: null,
    video_url: null,
    extraction_confidence: {},
    fields_missing: ["gpa", "sat_score", "act_score", "club_team"],
    fields_extracted: 14,
    fields_total: 18,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeConfig(overrides: Partial<ProgramConfig> = {}): ProgramConfig {
  return {
    id: "config-1",
    program_id: "program-1",
    updated_by_coach_id: "coach-1",
    min_gpa: null,
    min_sat: null,
    min_act: null,
    min_height_by_position: {},
    accepted_grad_years: [],
    accepted_positions: [],
    weight_academic: 100,
    weight_competition: 0,
    weight_physical: 0,
    weight_position_fit: 0,
    weight_grad_year: 0,
    weight_completeness: 0,
    high_need_positions: {},
    priority_grad_years: [],
    roster_spots: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("calculateDQS zero-weight completeness behavior", () => {
  it("does not apply completeness penalty when completeness weight is zero", () => {
    const recruit = makeRecruit();

    const result = calculateDQS(recruit, makeConfig());

    expect(result.isQualified).toBe(true);
    expect(result.completenessPenalty).toBe(0);
    expect(result.score).toBe(100);
  });

  it("removes academic missing drag from completion factor when academic weight is zero", () => {
    const recruit = makeRecruit({
      fields_missing: ["gpa", "sat_score", "act_score"],
      fields_extracted: 16,
      fields_total: 18,
    });
    const config = makeConfig({
      weight_academic: 0,
      weight_competition: 0,
      weight_physical: 0,
      weight_position_fit: 0,
      weight_grad_year: 0,
      weight_completeness: 100,
    });

    const result = calculateDQS(recruit, config);

    expect(result.componentScores.completeness).toBe(100);
    expect(result.completenessPenalty).toBe(0);
    expect(result.score).toBe(100);
  });

  it("applies completeness penalty when club level is unknown", () => {
    const recruit = makeRecruit({
      gpa: null,
      fields_missing: ["phone"],
      fields_extracted: 15,
      fields_total: 18,
      club_level: "unknown",
    });
    const config = makeConfig({
      weight_academic: 0,
      weight_competition: 100,
      weight_physical: 0,
      weight_position_fit: 0,
      weight_grad_year: 0,
      weight_completeness: 100,
    });

    const result = calculateDQS(recruit, config);

    expect(result.componentScores.completeness).toBe(67);
    expect(result.completenessPenalty).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(100);
  });

  it("uses both SAT and ACT when both are present for academic scoring", () => {
    const recruit = makeRecruit({
      gpa: null,
      sat_score: 1200,
      act_score: 30,
      fields_missing: ["phone"],
      fields_extracted: 18,
      fields_total: 18,
    });
    const config = makeConfig({
      weight_academic: 100,
      weight_competition: 0,
      weight_physical: 0,
      weight_position_fit: 0,
      weight_grad_year: 0,
      weight_completeness: 0,
    });

    const result = calculateDQS(recruit, config);

    expect(result.componentScores.academic).toBeCloseTo(74.8, 1);
  });
});
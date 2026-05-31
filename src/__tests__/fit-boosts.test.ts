import { describe, expect, it } from "vitest";
import { calculateBonus } from "@/lib/scoring/components";
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
    positions: ["LB"],
    preferred_foot: null,
    height_inches: null,
    weight_lbs: null,
    gpa: null,
    sat_score: null,
    act_score: null,
    club_team: null,
    club_level: "unknown",
    high_school_team: null,
    video_url: null,
    extraction_confidence: {},
    fields_missing: [],
    fields_extracted: 18,
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
    preferred_foot_by_position: {},
    preferred_height_range_by_position: {},
    boost_preferred_foot: 2,
    boost_preferred_height: 3,
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

describe("calculateBonus — preferred foot", () => {
  it("awards the configured magnitude when the foot matches", () => {
    const result = calculateBonus(
      makeRecruit({ preferred_foot: "Left" }),
      makeConfig({ preferred_foot_by_position: { LB: "Left" } })
    );
    expect(result.points).toBe(2);
    expect(result.reasons).toEqual([
      "+2 for preferred left foot at LB",
    ]);
  });

  it("uses the coach-configured magnitude, not a hardcoded value", () => {
    const result = calculateBonus(
      makeRecruit({ preferred_foot: "Right" }),
      makeConfig({
        boost_preferred_foot: 7,
        preferred_foot_by_position: { LB: "Right" },
      })
    );
    expect(result.points).toBe(7);
    expect(result.reasons[0]).toContain("+7");
  });

  it("does not boost when the preference is 'Either'", () => {
    const result = calculateBonus(
      makeRecruit({ preferred_foot: "Left" }),
      makeConfig({ preferred_foot_by_position: { LB: "Either" } })
    );
    expect(result.points).toBe(0);
    expect(result.reasons).toEqual([]);
  });

  it("treats a two-footed recruit as satisfying any specific preference", () => {
    for (const foot of ["Both", "either", "Two-footed"]) {
      const result = calculateBonus(
        makeRecruit({ preferred_foot: foot }),
        makeConfig({ preferred_foot_by_position: { LB: "Left" } })
      );
      expect(result.points).toBe(2);
    }
  });

  it("does not boost when the foot does not match", () => {
    const result = calculateBonus(
      makeRecruit({ preferred_foot: "Right" }),
      makeConfig({ preferred_foot_by_position: { LB: "Left" } })
    );
    expect(result.points).toBe(0);
  });

  it("does not boost when the recruit has no foot data", () => {
    const result = calculateBonus(
      makeRecruit({ preferred_foot: null }),
      makeConfig({ preferred_foot_by_position: { LB: "Left" } })
    );
    expect(result.points).toBe(0);
  });

  it("does not boost when the magnitude is set to 0", () => {
    const result = calculateBonus(
      makeRecruit({ preferred_foot: "Left" }),
      makeConfig({
        boost_preferred_foot: 0,
        preferred_foot_by_position: { LB: "Left" },
      })
    );
    expect(result.points).toBe(0);
  });

  it("counts a matching foot only once across multiple positions", () => {
    const result = calculateBonus(
      makeRecruit({ preferred_foot: "Left", positions: ["LB", "LW"] }),
      makeConfig({ preferred_foot_by_position: { LB: "Left", LW: "Left" } })
    );
    expect(result.points).toBe(2);
  });
});

describe("calculateBonus — preferred height range", () => {
  it("awards the configured magnitude when height is within range", () => {
    const result = calculateBonus(
      makeRecruit({ height_inches: 70 }),
      makeConfig({ preferred_height_range_by_position: { LB: { min: 68, max: 72 } } })
    );
    expect(result.points).toBe(3);
    expect(result.reasons[0]).toBe("+3 for height within preferred range at LB");
  });

  it("respects a min-only bound", () => {
    const config = makeConfig({
      preferred_height_range_by_position: { LB: { min: 68 } },
    });
    expect(calculateBonus(makeRecruit({ height_inches: 70 }), config).points).toBe(3);
    expect(calculateBonus(makeRecruit({ height_inches: 66 }), config).points).toBe(0);
  });

  it("respects a max-only bound", () => {
    const config = makeConfig({
      preferred_height_range_by_position: { LB: { max: 72 } },
    });
    expect(calculateBonus(makeRecruit({ height_inches: 70 }), config).points).toBe(3);
    expect(calculateBonus(makeRecruit({ height_inches: 74 }), config).points).toBe(0);
  });

  it("does not boost for an empty range object", () => {
    const result = calculateBonus(
      makeRecruit({ height_inches: 70 }),
      makeConfig({ preferred_height_range_by_position: { LB: {} } })
    );
    expect(result.points).toBe(0);
  });

  it("does not boost when the recruit has no height data", () => {
    const result = calculateBonus(
      makeRecruit({ height_inches: null }),
      makeConfig({ preferred_height_range_by_position: { LB: { min: 68, max: 72 } } })
    );
    expect(result.points).toBe(0);
  });

  it("does not boost when the magnitude is set to 0", () => {
    const result = calculateBonus(
      makeRecruit({ height_inches: 70 }),
      makeConfig({
        boost_preferred_height: 0,
        preferred_height_range_by_position: { LB: { min: 68, max: 72 } },
      })
    );
    expect(result.points).toBe(0);
  });
});

describe("calculateBonus — totals and cap", () => {
  it("falls back to default magnitudes when config columns are absent", () => {
    const config = makeConfig({ preferred_foot_by_position: { LB: "Left" } });
    // Simulate a legacy row missing the configurable-boost columns.
    delete (config as Partial<ProgramConfig>).boost_preferred_foot;
    const result = calculateBonus(makeRecruit({ preferred_foot: "Left" }), config);
    expect(result.points).toBe(2);
  });

  it("sums every boost source", () => {
    const result = calculateBonus(
      makeRecruit({
        preferred_foot: "Left",
        height_inches: 70,
        graduation_year: 2027,
        positions: ["LB"],
      }),
      makeConfig({
        high_need_positions: { "2027": [{ position: "LB", rank: 1 }] },
        priority_grad_years: [{ year: 2027, rank: 1 }],
        preferred_foot_by_position: { LB: "Left" },
        preferred_height_range_by_position: { LB: { min: 68, max: 72 } },
        boost_preferred_foot: 2,
        boost_preferred_height: 3,
      })
    );
    // position 5 + grad year 5 + foot 2 + height 3
    expect(result.points).toBe(15);
  });

  it("caps the total at the theoretical maximum (30)", () => {
    const result = calculateBonus(
      makeRecruit({
        preferred_foot: "Left",
        height_inches: 70,
        graduation_year: 2027,
        positions: ["LB"],
      }),
      makeConfig({
        high_need_positions: { "2027": [{ position: "LB", rank: 1 }] },
        priority_grad_years: [{ year: 2027, rank: 1 }],
        preferred_foot_by_position: { LB: "Left" },
        preferred_height_range_by_position: { LB: { min: 68, max: 72 } },
        boost_preferred_foot: 10,
        boost_preferred_height: 10,
      })
    );
    // position 5 + grad year 5 + foot 10 + height 10 = 30 (the cap)
    expect(result.points).toBe(30);
  });
});

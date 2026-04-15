import { describe, it, expect } from "vitest";
import { chooseSurvivor, buildMergedPayload } from "../lib/recruits/merge-payload";
import type { Recruit } from "../types/database";

function makeRecruit(overrides: Partial<Recruit> & { id: string }): Recruit {
  return {
    coach_id: "coach-1",
    program_id: "prog-1",
    name_key: "alex johnson",
    email: null,
    full_name: "Alex Johnson",
    phone: null,
    graduation_year: null,
    current_school: null,
    city: null,
    state: null,
    country: null,
    positions: [],
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
    fields_extracted: 0,
    fields_total: 10,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("chooseSurvivor", () => {
  it("picks the most complete recruit", () => {
    const a = makeRecruit({ id: "a", fields_extracted: 5 });
    const b = makeRecruit({ id: "b", fields_extracted: 8 });
    const c = makeRecruit({ id: "c", fields_extracted: 3 });
    expect(chooseSurvivor([a, b, c]).id).toBe("b");
  });

  it("breaks ties by recency (most recently updated)", () => {
    const a = makeRecruit({ id: "a", fields_extracted: 5, updated_at: "2024-01-01T00:00:00Z" });
    const b = makeRecruit({ id: "b", fields_extracted: 5, updated_at: "2024-06-01T00:00:00Z" });
    expect(chooseSurvivor([a, b]).id).toBe("b");
  });
});

describe("buildMergedPayload", () => {
  it("merges fields from multiple recruits", () => {
    const a = makeRecruit({
      id: "a",
      gpa: 3.8,
      extraction_confidence: { gpa: "high" },
      fields_extracted: 3,
      updated_at: "2024-01-01T00:00:00Z",
    });
    const b = makeRecruit({
      id: "b",
      sat_score: 1450,
      city: "Portland",
      extraction_confidence: { sat_score: "high", city: "medium" },
      fields_extracted: 2,
      updated_at: "2024-02-01T00:00:00Z",
    });

    const payload = buildMergedPayload([a, b]);
    expect(payload.gpa).toBe(3.8);
    expect(payload.sat_score).toBe(1450);
    expect(payload.city).toBe("Portland");
  });

  it("prefers higher-confidence value when fields conflict", () => {
    const a = makeRecruit({
      id: "a",
      gpa: 3.5,
      extraction_confidence: { gpa: "low" },
      updated_at: "2024-03-01T00:00:00Z", // newer but low confidence
    });
    const b = makeRecruit({
      id: "b",
      gpa: 3.9,
      extraction_confidence: { gpa: "high" },
      updated_at: "2024-01-01T00:00:00Z",
    });

    const payload = buildMergedPayload([a, b]);
    expect(payload.gpa).toBe(3.9); // high confidence wins even though b is older
  });

  it("never overwrites a populated value with null", () => {
    const a = makeRecruit({ id: "a", gpa: 3.8, fields_extracted: 3 });
    const b = makeRecruit({ id: "b", gpa: null, fields_extracted: 1 }); // gpa missing

    const payload = buildMergedPayload([a, b]);
    expect(payload.gpa).toBe(3.8);
  });

  it("unions positions from all recruits", () => {
    const a = makeRecruit({ id: "a", positions: ["Forward", "Midfielder"] });
    const b = makeRecruit({ id: "b", positions: ["Midfielder", "Defender"] });

    const payload = buildMergedPayload([a, b]);
    expect(payload.positions).toContain("Forward");
    expect(payload.positions).toContain("Midfielder");
    expect(payload.positions).toContain("Defender");
    // No duplicates
    expect(payload.positions!.filter((p) => p === "Midfielder")).toHaveLength(1);
  });

  it("does not use the current recruit's confidence to evaluate its own field (regression for confidence-lookup bug)", () => {
    // Recruit A has GPA 3.5 with HIGH confidence.
    // Recruit B has GPA 3.9 with LOW confidence (processed after A).
    // B must NOT win just because its own confidence is being compared to itself.
    const a = makeRecruit({
      id: "a",
      gpa: 3.5,
      extraction_confidence: { gpa: "high" },
      fields_extracted: 1,
      updated_at: "2024-01-01T00:00:00Z",
    });
    const b = makeRecruit({
      id: "b",
      gpa: 3.9,
      extraction_confidence: { gpa: "low" },
      fields_extracted: 1,
      updated_at: "2024-06-01T00:00:00Z", // newer but lower confidence
    });

    const payload = buildMergedPayload([a, b]);
    // A's high-confidence GPA 3.5 should win over B's low-confidence GPA 3.9
    expect(payload.gpa).toBe(3.5);
  });

  it("a sparse update (only sat_score) updates that one field without losing others", () => {
    // Simulate a more complete profile
    const full = makeRecruit({
      id: "full",
      full_name: "Alex Johnson",
      gpa: 3.8,
      city: "Portland",
      sat_score: null,
      extraction_confidence: { full_name: "high", gpa: "high", city: "high" },
      fields_extracted: 5,
      updated_at: "2024-01-01T00:00:00Z",
    });
    // Sparse follow-up with only SAT
    const sparse = makeRecruit({
      id: "sparse",
      sat_score: 1450,
      extraction_confidence: { sat_score: "high" },
      fields_extracted: 1,
      updated_at: "2024-06-01T00:00:00Z",
    });

    const payload = buildMergedPayload([full, sparse]);
    expect(payload.sat_score).toBe(1450);
    expect(payload.gpa).toBe(3.8);
    expect(payload.city).toBe("Portland");
    expect(payload.full_name).toBe("Alex Johnson");
  });
});

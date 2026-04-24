import { describe, it, expect } from "vitest";
import { buildUpdateData } from "../lib/recruits/update-data";

function makeExisting(overrides: Record<string, unknown> = {}) {
  return {
    full_name: "Alex Johnson",
    email: "alex@example.com",
    gpa: 3.8,
    sat_score: 1200,
    positions: ["CB"],
    club_level: "unknown",
    extraction_confidence: {
      full_name: "high",
      gpa: "high",
      sat_score: "medium",
    },
    fields_missing: [] as string[],
    fields_extracted: 3,
    fields_total: 10,
    ...overrides,
  };
}

describe("buildUpdateData", () => {
  it("does not overwrite with null values", () => {
    const update = buildUpdateData(
      makeExisting(),
      { gpa: null, sat_score: 1400 },
      { sat_score: "high" }
    );
    expect(update.gpa).toBeUndefined();
    expect(update.sat_score).toBe(1400);
  });

  it("overwrites when new confidence is higher", () => {
    const update = buildUpdateData(
      makeExisting(),
      { sat_score: 1350 },
      { sat_score: "high" }   // existing is "medium"
    );
    expect(update.sat_score).toBe(1350);
  });

  it("overwrites when confidence is equal (new wins)", () => {
    const update = buildUpdateData(
      makeExisting(),
      { gpa: 3.9 },
      { gpa: "high" }          // existing is also "high"
    );
    expect(update.gpa).toBe(3.9);
  });

  it("does NOT overwrite when new confidence is lower", () => {
    const update = buildUpdateData(
      makeExisting(),
      { gpa: 2.0 },
      { gpa: "low" }           // existing is "high"
    );
    expect(update.gpa).toBeUndefined();
  });

  it("always merges extraction_confidence metadata", () => {
    const update = buildUpdateData(
      makeExisting(),
      { sat_score: 1500, phone: "555-1234" },
      { sat_score: "high", phone: "medium" }
    );
    expect((update.extraction_confidence as Record<string, string>).sat_score).toBe("high");
    expect((update.extraction_confidence as Record<string, string>).phone).toBe("medium");
    expect((update.extraction_confidence as Record<string, string>).full_name).toBe("high");
  });

  it("recomputes completeness counters from effective merged record", () => {
    const update = buildUpdateData(
      makeExisting(),
      { fields_missing: ["phone"], fields_extracted: 9, fields_total: 10 },
      {}
    );
    // Incoming metadata should not be trusted if values were not actually merged.
    expect(update.fields_missing).not.toEqual(["phone"]);
    expect(update.fields_extracted).toBe(6);
    expect(update.fields_total).toBe(18);
    expect(update.fields_missing).toContain("phone");
    expect(update.fields_missing).not.toContain("act_score");
  });

  it("does not let rejected low-confidence values skew completeness metadata", () => {
    const update = buildUpdateData(
      makeExisting(),
      { gpa: 1.9, fields_missing: [], fields_extracted: 19, fields_total: 19 },
      { gpa: "low" }
    );

    expect(update.gpa).toBeUndefined();
    expect(update.fields_extracted).toBe(6);
    expect(update.fields_total).toBe(18);
    expect(update.fields_missing).toContain("phone");
  });

  it("does NOT overwrite when existing has confidence but new does not", () => {
    // existingConf && !newConf: new extraction has no confidence metadata → keep existing
    const update = buildUpdateData(
      makeExisting(),       // gpa existing confidence = "high"
      { gpa: 2.0 },        // new value present but no confidence key
      {}                   // no confidence for gpa
    );
    expect(update.gpa).toBeUndefined();
  });

  it("neither side has confidence metadata → overwrites unconditionally", () => {
    // No confidence on existing record, no confidence on new extraction.
    // The `!existingConf && !newConf` branch: update[field] = value.
    const existing = makeExisting({ extraction_confidence: {} }); // no confidence at all
    const update = buildUpdateData(existing, { club_team: "FC Dynamo" }, {});
    expect(update.club_team).toBe("FC Dynamo");
  });

  it("a sparse follow-up email can update a single field (sat_score) without losing others", () => {
    // Simulate a more complete existing recruit
    const existing = makeExisting({
      full_name: "Alex Johnson",
      gpa: 3.8,
      sat_score: null,   // not yet known
      city: "Portland",
      extraction_confidence: {
        full_name: "high",
        gpa: "high",
        city: "high",
      },
    });

    // Sparse follow-up only provides sat_score
    const update = buildUpdateData(
      existing,
      { sat_score: 1450 },
      { sat_score: "high" }
    );

    expect(update.sat_score).toBe(1450);
    // Other fields are untouched (not in update)
    expect(update.gpa).toBeUndefined();
    expect(update.full_name).toBeUndefined();
  });
});

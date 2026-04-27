import { describe, expect, it } from "vitest";
import { computeCompletenessMetadata } from "@/lib/recruits/completeness-metadata";

describe("computeCompletenessMetadata", () => {
  it("drops one test slot when exactly one of SAT/ACT exists", () => {
    const result = computeCompletenessMetadata({
      full_name: "Casey",
      email: "casey@example.com",
      positions: ["CB"],
      sat_score: 1300,
      act_score: null,
      club_level: "unknown",
    });

    expect(result.fields_total).toBe(18);
    expect(result.fields_missing).not.toContain("act_score");
    expect(result.fields_missing).toContain("phone");
  });

  it("keeps full test slots when both SAT and ACT are missing", () => {
    const result = computeCompletenessMetadata({
      full_name: "Casey",
      email: "casey@example.com",
      positions: ["CB"],
      sat_score: null,
      act_score: null,
      club_level: "unknown",
    });

    expect(result.fields_total).toBe(19);
    expect(result.fields_missing).toContain("sat_score");
    expect(result.fields_missing).toContain("act_score");
  });

  it("treats empty positions as missing", () => {
    const result = computeCompletenessMetadata({
      full_name: "Casey",
      email: "casey@example.com",
      positions: [],
      sat_score: 1300,
      act_score: null,
      club_level: "unknown",
    });

    expect(result.fields_missing).toContain("positions");
  });
});

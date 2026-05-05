import { describe, expect, it } from "vitest";
import { adjustCompletenessForWeights } from "@/lib/scoring/completeness";

describe("adjustCompletenessForWeights", () => {
  it("keeps the SAT/ACT completeness slot stable without config", () => {
    const result = adjustCompletenessForWeights(
      ["act_score", "city"],
      10,
      18
    );

    expect(result.missing).toEqual(["act_score", "city"]);
    expect(result.total).toBe(18);
    expect(result.extracted).toBe(10);
  });

  it("excludes academic missing fields when academic weight is zero", () => {
    const result = adjustCompletenessForWeights(
      ["gpa", "sat_score", "act_score"],
      16,
      18,
      {
        weight_academic: 0,
        weight_competition: 50,
        weight_physical: 50,
        weight_position_fit: 50,
        weight_grad_year: 50,
        weight_completeness: 20,
      }
    );

    expect(result.missing).toEqual([]);
    expect(result.extracted).toBe(16);
    expect(result.total).toBe(16);
    expect(result.percent).toBe(100);
  });

  it("excludes competition and physical fields from visible missing counts when weights are zero", () => {
    const result = adjustCompletenessForWeights(
      ["club_team", "club_level", "height_inches", "weight_lbs", "phone"],
      14,
      18,
      {
        weight_academic: 70,
        weight_competition: 0,
        weight_physical: 0,
        weight_position_fit: 80,
        weight_grad_year: 50,
        weight_completeness: 20,
      }
    );

    expect(result.missing).toEqual(["phone"]);
    expect(result.total).toBe(14);
    expect(result.extracted).toBe(14);
  });

  it("treats unknown club level as missing for completeness", () => {
    const result = adjustCompletenessForWeights(
      ["phone"],
      15,
      18,
      undefined,
      "unknown"
    );

    expect(result.missing).toEqual(["phone", "club_level"]);
    expect(result.total).toBe(18);
    expect(result.extracted).toBe(14);
    expect(result.percent).toBe(78);
  });

  it("does not penalize unknown club level when competition weight is zero", () => {
    const result = adjustCompletenessForWeights(
      ["phone"],
      15,
      18,
      {
        weight_academic: 70,
        weight_competition: 0,
        weight_physical: 50,
        weight_position_fit: 80,
        weight_grad_year: 50,
        weight_completeness: 20,
      },
      "unknown"
    );

    expect(result.missing).toEqual(["phone"]);
    expect(result.total).toBe(16);
    expect(result.extracted).toBe(13);
  });
});
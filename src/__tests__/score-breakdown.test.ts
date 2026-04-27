import { describe, expect, it } from "vitest";
import { getScoreDisplayValue } from "@/components/scoring/score-breakdown";

describe("getScoreDisplayValue", () => {
  const programConfig = {
    weight_academic: 30,
    weight_competition: 20,
    weight_physical: 15,
    weight_position_fit: 15,
    weight_grad_year: 10,
    weight_completeness: 10,
  };

  it("shows NA for zero-weight score components", () => {
    expect(getScoreDisplayValue(84.2, { ...programConfig, weight_academic: 0 }, "academic")).toBe("NA");
    expect(getScoreDisplayValue(72, { ...programConfig, weight_completeness: 0 }, "completeness")).toBe("NA");
  });

  it("keeps regular missing values as N/A", () => {
    expect(getScoreDisplayValue(null, programConfig, "academic")).toBe("N/A");
  });

  it("rounds visible scores when the weight is active", () => {
    expect(getScoreDisplayValue(84.6, programConfig, "academic")).toBe("85");
  });
});
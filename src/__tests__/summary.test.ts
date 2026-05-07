import { describe, expect, it } from "vitest";
import { formatSummaryScore } from "@/lib/scoring/summary";

describe("formatSummaryScore", () => {
  it("suppresses zero-weight scores as N/A", () => {
    expect(formatSummaryScore(92.4, 0)).toBe("N/A");
  });

  it("shows N/A for missing scores when weight is active", () => {
    expect(formatSummaryScore(null, 50)).toBe("N/A");
  });

  it("rounds visible scores when weight is active", () => {
    expect(formatSummaryScore(84.6, 50)).toBe("85");
  });
});
import { describe, expect, it } from "vitest";
import { getLeagueLabel, getLeagueRating, isLeagueSelected } from "@/lib/data/leagues";
import { shouldInferGaAspireClubLevel } from "@/lib/extraction/extract";

describe("GA Aspire handling", () => {
  it("inherits GA preference selection", () => {
    expect(isLeagueSelected("ga_aspire", ["ga"])).toBe(true);
    expect(isLeagueSelected("ga_aspire", [])).toBe(false);
  });

  it("uses GA Aspire label and GA rating fallback", () => {
    expect(getLeagueLabel("ga_aspire")).toBe("GA Aspire");
    expect(getLeagueRating("ga_aspire", { ga: 7.5 } as never)).toBe(7.5);
  });

  it("only promotes Aspire when the recruit context is girls and the email mentions Aspire", () => {
    expect(
      shouldInferGaAspireClubLevel({
        subject: "Re: interest",
        bodyPlain: "I play for the Aspire program in GA.",
        isBoys: false,
        directoryLevel: "ga",
      })
    ).toBe(true);

    expect(
      shouldInferGaAspireClubLevel({
        subject: "Re: interest",
        bodyPlain: "I play for the Aspire program in GA.",
        isBoys: true,
        directoryLevel: "ga",
      })
    ).toBe(false);

    expect(
      shouldInferGaAspireClubLevel({
        subject: "Aspire questions",
        bodyPlain: "Please see my profile below.",
        isBoys: false,
        directoryLevel: "unknown",
      })
    ).toBe(true);
  });
});
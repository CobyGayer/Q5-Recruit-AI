import { describe, expect, it } from "vitest";
import { getLeagueLabel, getLeagueRating, isLeagueSelected } from "@/lib/data/leagues";
import { shouldInferEcrlClubLevel, shouldInferGaAspireClubLevel } from "@/lib/extraction/extract";

describe("GA Aspire handling", () => {
  it("inherits GA preference selection", () => {
    expect(isLeagueSelected("ga_aspire", ["ga"])).toBe(true);
    expect(isLeagueSelected("ga_aspire", [])).toBe(false);
  });

  it("uses GA Aspire label and GA Aspire rating", () => {
    expect(getLeagueLabel("ga_aspire")).toBe("GA Aspire");
    expect(getLeagueRating("ga_aspire", { ga_aspire: 6.5 } as never)).toBe(6.5);
    expect(getLeagueRating("ga_aspire", {} as never)).toBe(7);
  });

  it("treats ECRL as an ECNL sublevel for selection", () => {
    expect(isLeagueSelected("ecrl", ["ecnl"])).toBe(true);
    expect(isLeagueSelected("ecrl", [])).toBe(false);
    expect(getLeagueLabel("ecrl")).toBe("ECRL");
    expect(getLeagueRating("ecrl", { ecrl: 8 } as never)).toBe(8);
    expect(getLeagueRating("ecrl", {} as never)).toBe(8.5);
  });

  it("only promotes Aspire when the recruit context is girls and the email mentions Aspire", () => {
    expect(
      shouldInferGaAspireClubLevel({
        subject: "Re: interest",
        bodyPlain: "I play for the Aspire program in GA.",
        isBoys: false,
        directoryLevel: "ga",
        originalClubLevel: "ga",
      })
    ).toBe(true);

    expect(
      shouldInferGaAspireClubLevel({
        subject: "Re: interest",
        bodyPlain: "I play for the Aspire program in GA.",
        isBoys: true,
        directoryLevel: "ga",
        originalClubLevel: "ga",
      })
    ).toBe(false);

    expect(
      shouldInferGaAspireClubLevel({
        subject: "Aspire questions",
        bodyPlain: "Please see my profile below.",
        isBoys: false,
        directoryLevel: "unknown",
        originalClubLevel: "unknown",
      })
    ).toBe(true);
  });

  it("promotes ECNL clubs to ECRL when the email mentions ECRL variants", () => {
    expect(
      shouldInferEcrlClubLevel({
        subject: "Update",
        bodyPlain: "We compete in ECNL-RL and want to connect.",
        isBoys: false,
        directoryLevel: "ecnl",
      })
    ).toBe(true);

    expect(
      shouldInferEcrlClubLevel({
        subject: "Update",
        bodyPlain: "We compete in ECNL regional and want to connect.",
        isBoys: false,
        directoryLevel: "ecnl",
      })
    ).toBe(true);

    expect(
      shouldInferEcrlClubLevel({
        subject: "Update",
        bodyPlain: "We compete in ECRL.",
        isBoys: true,
        directoryLevel: "ecnl",
      })
    ).toBe(false);

    expect(
      shouldInferEcrlClubLevel({
        subject: "Update",
        bodyPlain: "We compete in ECRL.",
        isBoys: false,
        directoryLevel: "ga",
      })
    ).toBe(false);
  });
});
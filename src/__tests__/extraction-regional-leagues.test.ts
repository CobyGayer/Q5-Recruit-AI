import { describe, it, expect } from "vitest";
import { shouldInferEcrlClubLevel, shouldInferGaAspireClubLevel } from "@/lib/extraction/extract";
import { lookupClubLevel } from "@/lib/data/club-directory";

describe("Regional league inference edge cases", () => {
  describe("ECRL inference", () => {
    it("infers ECRL when email mentions ECNL-RL variant and directory says ECNL (girls)", () => {
      const body = "Our teams compete in ECNL-RL and we travel regionally.";
      const dir = "ecnl" as const;
      expect(shouldInferEcrlClubLevel({ subject: "", bodyPlain: body, isBoys: false, directoryLevel: dir })).toBe(true);
    });

    it("does not infer ECRL when mention is generic but directory is GA", () => {
      const body = "We compete in ECNL regional competitions.";
      const dir = "ga" as const;
      expect(shouldInferEcrlClubLevel({ subject: "", bodyPlain: body, isBoys: false, directoryLevel: dir })).toBe(false);
    });

    it("does not infer ECRL for boys even if text contains ECRL", () => {
      const body = "ECRL is what we play in this year.";
      const dir = "ecnl" as const;
      expect(shouldInferEcrlClubLevel({ subject: "", bodyPlain: body, isBoys: true, directoryLevel: dir })).toBe(false);
    });

    it("recognizes ECNL text variants (ecnl rl, ecnl-rl, ecrl)", () => {
      const variants = ["ecnl rl", "ecnl-rl", "ECRL", "ECNL-RL", "ecnl regional"]; // mixed case
      for (const v of variants) {
        expect(shouldInferEcrlClubLevel({ subject: "", bodyPlain: `We play in ${v} this season.`, isBoys: false, directoryLevel: "ecnl" as const })).toBe(true);
      }
    });
  });

  describe("GA Aspire inference", () => {
    it("infers GA Aspire for girls when directory is GA and body contains 'Aspire'", () => {
      const body = "I play for the Aspire program in GA and we're looking for exposure.";
      expect(shouldInferGaAspireClubLevel({ subject: "", bodyPlain: body, isBoys: false, directoryLevel: "ga" as const })).toBe(true);
    });

    it("infers GA Aspire for girls when directory unknown but body contains 'Aspire'", () => {
      const body = "Aspire program player here.";
      expect(shouldInferGaAspireClubLevel({ subject: "", bodyPlain: body, isBoys: false, directoryLevel: "unknown" as const })).toBe(true);
    });

    it("does not infer for boys even if Aspire is mentioned", () => {
      const body = "I am part of the aspire program in GA.";
      expect(shouldInferGaAspireClubLevel({ subject: "", bodyPlain: body, isBoys: true, directoryLevel: "ga" as const })).toBe(false);
    });

    it("currently infers when 'aspire' appears as a verb (edge case)", () => {
      const body = "I aspire to play at the next level.";
      // Note: the current implementation matches the token 'aspire' without
      // requiring program context, so this returns true. The test documents
      // this edge-case behavior.
      expect(shouldInferGaAspireClubLevel({ subject: "", bodyPlain: body, isBoys: false, directoryLevel: "ga" as const })).toBe(true);
    });
  });

  describe("Integration of directory lookup and inference rules", () => {
    it("lookupClubLevel returns 'ecnl' for a known ECNL club and inference promotes to ecrl when mentioned in girls email", () => {
      // Find an ECNL club from the girls directory (use a known example from existing tests)
      const clubName = "Arlington Soccer"; // present in girls JSON as ECNL
      const dirLevel = lookupClubLevel(clubName, false);
      expect(dirLevel).toBe("ecnl");

      const body = "We compete in ECNL-RL at the regional level.";
      expect(shouldInferEcrlClubLevel({ subject: "", bodyPlain: body, isBoys: false, directoryLevel: dirLevel })).toBe(true);
    });

    it("when club is ECNL but email is ambiguous, inference should still detect ecrl only for girls", () => {
      const clubName = "Arlington Soccer";
      const dirLevel = lookupClubLevel(clubName, false);
      const body = "We play regional competitions with ECNL regional travel.";
      expect(dirLevel).toBe("ecnl");
      expect(shouldInferEcrlClubLevel({ subject: "", bodyPlain: body, isBoys: false, directoryLevel: dirLevel })).toBe(true);
    });
  });
});

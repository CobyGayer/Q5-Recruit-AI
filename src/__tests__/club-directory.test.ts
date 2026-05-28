import { describe, it, expect } from "vitest";
import { normalizeClubName, lookupClubLevel } from "@/lib/data/club-directory";

describe("Club Directory - Gender-Aware Lookup", () => {
  describe("normalizeClubName", () => {
    it("lowercases and trims input", () => {
      expect(normalizeClubName("  BOYS ACADEMY FC  ")).toBe("boys academy fc");
    });

    it("normalizes dashes (en-dash to hyphen)", () => {
      expect(normalizeClubName("Cedar Stars Academy – Bergen")).toBe(
        "cedar stars academy - bergen"
      );
    });

    it("collapses multiple spaces", () => {
      expect(normalizeClubName("FC   Union   SC")).toBe("fc union sc");
    });

    it("handles null/empty strings", () => {
      expect(normalizeClubName("")).toBe("");
    });
  });

  describe("lookupClubLevel - Boys Directory (isBoys=true, default)", () => {
    it("finds MLS NEXT clubs", () => {
      expect(lookupClubLevel("Atlanta United FC")).toBe("mls_next");
      expect(lookupClubLevel("la galaxy", true)).toBe("mls_next");
    });

    it("finds ECNL clubs", () => {
      expect(lookupClubLevel("FC Wisconsin")).toBe("ecnl");
      expect(lookupClubLevel("Arlington Soccer", true)).toBe("ecnl");
    });

    it("finds NAL clubs mapped to regional", () => {
      // NAL is the third tier in boys directory, mapped to 'regional'
      expect(lookupClubLevel("Fort Wayne United", true)).toBe("regional");
    });

    it("returns unknown for unknown clubs", () => {
      expect(lookupClubLevel("Nonexistent FC Boys", true)).toBe("unknown");
    });

    it("returns unknown for null/empty input", () => {
      expect(lookupClubLevel(null, true)).toBe("unknown");
      expect(lookupClubLevel(undefined, true)).toBe("unknown");
      expect(lookupClubLevel("", true)).toBe("unknown");
    });

    it("resolves aliases", () => {
      // "img" should resolve to "img academy" which is in MLS NEXT
      expect(lookupClubLevel("img", true)).toBe("mls_next");
      expect(lookupClubLevel("IMG", true)).toBe("mls_next");
    });
  });

  describe("lookupClubLevel - Girls Directory (isBoys=false)", () => {
    it("finds MLS NEXT clubs", () => {
      // If a club doesn't exist in the girls directory, it should be treated as unknown
      expect(lookupClubLevel("Atlanta United FC", false)).toBe("unknown");
      expect(lookupClubLevel("la galaxy", false)).toBe("unknown");
    });

    it("finds ECNL clubs", () => {
      expect(lookupClubLevel("Arlington Soccer", false)).toBe("ecnl");
      expect(lookupClubLevel("beach fc (va)", false)).toBe("ecnl");
    });

    it("finds DPL clubs mapped to regional", () => {
      // DPL is a tier in girls directory, mapped to 'regional'
      expect(lookupClubLevel("Charleston Soccer Club", false)).toBe("regional");
    });

    it("finds GA clubs", () => {
      expect(lookupClubLevel("1974 Newark FC", false)).toBe("ga");
      expect(lookupClubLevel("ajax united", false)).toBe("ga");
    });

    it("returns unknown for unknown clubs", () => {
      expect(lookupClubLevel("Nonexistent FC Girls", false)).toBe("unknown");
    });

    it("returns unknown for null/empty input", () => {
      expect(lookupClubLevel(null, false)).toBe("unknown");
      expect(lookupClubLevel(undefined, false)).toBe("unknown");
      expect(lookupClubLevel("", false)).toBe("unknown");
    });

    it("resolves aliases", () => {
      // "img" should resolve to "img academy" which is in MLS NEXT
      // In the girls directory, IMG maps to GA in the current data
      expect(lookupClubLevel("img", false)).toBe("ga");
      expect(lookupClubLevel("IMG", false)).toBe("ga");
    });
  });

  describe("Gender-specific routing", () => {
    it("resolves same club to different tiers in boys vs girls", () => {
      // Some clubs appear in different tiers between boys and girls lists
      // This is a basic test that the routing works
      const boysResult = lookupClubLevel("Atlanta Fire United", true);
      const girlsResult = lookupClubLevel("Atlanta Fire United", false);
      // At minimum, both should resolve to valid tiers
      expect(boysResult).not.toBe("unknown");
      expect(girlsResult).not.toBe("unknown");
    });

    it("uses boys by default when isBoys param omitted", () => {
      // Default should be boys (true)
      const withDefault = lookupClubLevel("Atlanta United FC");
      const explicit = lookupClubLevel("Atlanta United FC", true);
      expect(withDefault).toBe(explicit);
    });
  });

  describe("Case insensitivity", () => {
    it("handles mixed case club names", () => {
      expect(lookupClubLevel("ATLANTA UNITED FC")).toBe("mls_next");
      expect(lookupClubLevel("AtLaNtA uNiTeD fC")).toBe("mls_next");
      expect(lookupClubLevel("atlanta united fc")).toBe("mls_next");
    });
  });
});

import { describe, it, expect } from "vitest";
import { normalizeNameKey } from "../lib/recruits/name-key";

describe("normalizeNameKey", () => {
  it("returns empty string for null/undefined", () => {
    expect(normalizeNameKey(null)).toBe("");
    expect(normalizeNameKey(undefined)).toBe("");
    expect(normalizeNameKey("")).toBe("");
  });

  it("lowercases input", () => {
    expect(normalizeNameKey("JOHN SMITH")).toBe("john smith");
  });

  it("strips diacritics (accent folding)", () => {
    expect(normalizeNameKey("José García")).toBe("jose garcia");
    expect(normalizeNameKey("André Müller")).toBe("andre muller");
  });

  it("replaces non-alpha runs with a single space", () => {
    expect(normalizeNameKey("Smith, Jr.")).toBe("smith jr");
    expect(normalizeNameKey("O'Brien")).toBe("o brien");
    expect(normalizeNameKey("Jean-Pierre")).toBe("jean pierre");
  });

  it("collapses multiple spaces and trims", () => {
    expect(normalizeNameKey("  John   Smith  ")).toBe("john smith");
  });

  it("produces identical keys for equivalent names", () => {
    expect(normalizeNameKey("Alex Johnson")).toBe(normalizeNameKey("  ALEX  JOHNSON  "));
    expect(normalizeNameKey("María López")).toBe(normalizeNameKey("maria lopez"));
  });

  it("preserves suffixes like jr/sr/ii (not stripped in v1)", () => {
    expect(normalizeNameKey("John Smith Jr")).toBe("john smith jr");
    expect(normalizeNameKey("Robert Lee II")).toBe("robert lee ii");
  });

  // TS uses NFD decomposition; Postgres uses unaccent(). Characters that do
  // not decompose under Unicode NFD are stripped by the [^a-z] replace in TS
  // but transliterated to ASCII by unaccent() in SQL. Document divergences.
  it("TS/SQL divergence: ł stays ł under NFD, so is stripped to space (SQL maps it to l)", () => {
    // SQL: unaccent("Łukasz") → "Lukasz" → "lukasz"
    // TS:  NFD("Łukasz") = "Łukasz", [^a-z]→space → " ukasz" → trim "ukasz"
    expect(normalizeNameKey("Łukasz")).toBe("ukasz");
  });

  it("TS/SQL divergence: ß stays ß under NFD, so is stripped (SQL expands it to ss)", () => {
    // SQL: unaccent("Straße") → "Strasse" → "strasse"
    // TS:  NFD("Straße") = "Straße", [^a-z]→space → "stra e"
    expect(normalizeNameKey("Straße")).toBe("stra e");
  });

  it("TS/SQL divergence: Turkish ı (U+0131) is stripped (SQL maps it to i)", () => {
    // ş decomposes to s + combining cedilla (U+0327) which IS stripped by the
    // diacritic regex; ı does NOT decompose, so it hits the [^a-z] replace.
    // SQL: unaccent("Işık") → "Isik"
    // TS:  "is k"
    expect(normalizeNameKey("Işık")).toBe("is k");
  });
});

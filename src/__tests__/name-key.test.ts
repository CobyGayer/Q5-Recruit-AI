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
});

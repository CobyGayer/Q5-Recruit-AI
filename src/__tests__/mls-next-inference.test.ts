import { describe, it, expect } from "vitest";
import { shouldInferMlsNextSublevel } from "@/lib/extraction/extract";

describe("MLS Next inference guard", () => {
  it("returns false when originalClubLevel is not a sublevel", () => {
    const res = shouldInferMlsNextSublevel({ bodyPlain: "player from MLS NEXT", directoryLevel: "mls_next", originalClubLevel: "mls_next" as any });
    expect(res).toBe(false);
  });

  it("returns true when explicit 'homegrown' cue present", () => {
    const res = shouldInferMlsNextSublevel({ bodyPlain: "This player is a homegrown signing", directoryLevel: "mls_next", originalClubLevel: "mls_next_homegrown" });
    expect(res).toBe(true);
  });

  it("returns true when explicit 'mls next academy' cue present", () => {
    const res = shouldInferMlsNextSublevel({ bodyPlain: "played for the MLS Next Academy program", directoryLevel: "mls_next", originalClubLevel: "mls_next_academy" });
    expect(res).toBe(true);
  });

  it("respects the feature flag when cue absent", () => {
    const prev = process.env.ENABLE_MLS_NEXT_SUBLEVEL_INFERENCE;
    process.env.ENABLE_MLS_NEXT_SUBLEVEL_INFERENCE = "true";
    const res = shouldInferMlsNextSublevel({ bodyPlain: "no explicit cue here", directoryLevel: "mls_next", originalClubLevel: "mls_next_homegrown" });
    expect(res).toBe(true);
    process.env.ENABLE_MLS_NEXT_SUBLEVEL_INFERENCE = prev;
  });
});

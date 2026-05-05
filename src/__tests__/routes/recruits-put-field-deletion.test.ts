import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/admin-cookies", () => ({ getAdminProgramOverride: vi.fn() }));
vi.mock("@/lib/recruits/duplicate-review", () => ({ checkAndQueueDuplicateReview: vi.fn() }));
vi.mock("@/lib/recruits/completeness-metadata", () => ({ computeCompletenessMetadata: vi.fn() }));
vi.mock("@/lib/scoring/dqs", () => ({ calculateDQS: vi.fn() }));

import { PUT } from "@/app/api/recruits/[id]/route";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminProgramOverride } from "@/lib/admin-cookies";
import { computeCompletenessMetadata } from "@/lib/recruits/completeness-metadata";

type ChainOptions = {
  onUpdate?: (data: Record<string, unknown>) => void;
};

function makeChain(
  result: { data?: unknown; error?: unknown } = { data: null },
  options: ChainOptions = {}
) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "neq", "not", "in", "limit", "order", "insert", "delete"]) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  chain.update = vi.fn((data: Record<string, unknown>) => {
    options.onUpdate?.(data);
    return chain;
  });
  chain.single = vi.fn().mockResolvedValue(result);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  chain.upsert = vi.fn().mockResolvedValue({ error: result.error ?? null });
  chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
    Promise.resolve(result).then(resolve, reject);
  return chain as unknown;
}

function makeReq(body: unknown) {
  return {
    json: vi.fn().mockResolvedValue(body),
  } as unknown as import("next/server").NextRequest;
}

describe("PUT /api/recruits/[id] - field deletion/clearing confidence handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminProgramOverride).mockResolvedValue(null);
    vi.mocked(createAdminClient).mockReturnValue({ from: vi.fn() } as never);
  });

  it("should remove confidence entry when a field with existing high confidence is cleared (set to null)", async () => {
    let capturedUpdate: Record<string, unknown> | undefined;

    const updatedRecruitData = {
      id: "recruit-1",
      program_id: "prog-1",
      gpa: null, // Cleared
      name_key: "alex johnson",
      fields_missing: ["gpa"],
      fields_extracted: 1,
      fields_total: 10,
      extraction_confidence: {
        // gpa should be removed from confidence
        city: "medium",
      },
    };

    const fromFn = vi
      .fn()
      .mockReturnValueOnce(makeChain({ data: { role: "coach" } }))
      .mockReturnValueOnce(
        makeChain({
          data: {
            name_key: "alex johnson",
            extraction_confidence: {
              gpa: "high", // Had high confidence before
              city: "medium",
            },
          },
        })
      )
      .mockReturnValueOnce(
        makeChain({ data: updatedRecruitData }, { onUpdate: (data) => (capturedUpdate = data) })
      )
      .mockReturnValueOnce(makeChain({ data: null }))
      .mockReturnValueOnce(makeChain({ data: null }));

    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: fromFn,
    } as never);

    vi.mocked(computeCompletenessMetadata).mockReturnValue({
      fields_missing: ["gpa"],
      fields_extracted: 1,
      fields_total: 10,
    });

    const res = await PUT(makeReq({ gpa: null }), {
      params: Promise.resolve({ id: "recruit-1" }),
    });

    expect(res.status).toBe(200);
    expect(capturedUpdate).toBeDefined();
    
    // The update should include null for gpa
    expect(capturedUpdate?.gpa).toBeNull();
    
    // The update should include extraction_confidence with gpa removed
    expect(capturedUpdate?.extraction_confidence).toBeDefined();
    const updatedConfidence = capturedUpdate?.extraction_confidence as Record<string, string>;
    
    // GPA confidence should be removed/deleted
    expect(updatedConfidence.gpa).toBeUndefined();
    
    // Other fields' confidence should be preserved
    expect(updatedConfidence.city).toBe("medium");
  });

  it("should remove confidence entry when a field is cleared even if it was medium or low confidence", async () => {
    let capturedUpdate: Record<string, unknown> | undefined;

    const updatedRecruitData = {
      id: "recruit-1",
      program_id: "prog-1",
      sat_score: null, // Cleared
      name_key: "alex johnson",
      fields_missing: ["sat_score"],
      fields_extracted: 1,
      fields_total: 10,
      extraction_confidence: {
        // sat_score should be removed
        city: "medium",
      },
    };

    const fromFn = vi
      .fn()
      .mockReturnValueOnce(makeChain({ data: { role: "coach" } }))
      .mockReturnValueOnce(
        makeChain({
          data: {
            name_key: "alex johnson",
            extraction_confidence: {
              sat_score: "low", // Had low confidence
              city: "medium",
            },
          },
        })
      )
      .mockReturnValueOnce(
        makeChain({ data: updatedRecruitData }, { onUpdate: (data) => (capturedUpdate = data) })
      )
      .mockReturnValueOnce(makeChain({ data: null }))
      .mockReturnValueOnce(makeChain({ data: null }));

    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: fromFn,
    } as never);

    vi.mocked(computeCompletenessMetadata).mockReturnValue({
      fields_missing: ["sat_score"],
      fields_extracted: 1,
      fields_total: 10,
    });

    const res = await PUT(makeReq({ sat_score: null }), {
      params: Promise.resolve({ id: "recruit-1" }),
    });

    expect(res.status).toBe(200);
    const updatedConfidence = (capturedUpdate?.extraction_confidence) as Record<string, string>;
    
    // SAT score confidence should be removed when field is cleared
    expect(updatedConfidence.sat_score).toBeUndefined();
    expect(updatedConfidence.city).toBe("medium");
  });

  it("should preserve confidence for non-cleared fields when clearing one field", async () => {
    let capturedUpdate: Record<string, unknown> | undefined;

    const updatedRecruitData = {
      id: "recruit-1",
      program_id: "prog-1",
      gpa: null, // Cleared
      sat_score: 1350, // Changed/set
      name_key: "alex johnson",
      fields_missing: ["gpa"],
      fields_extracted: 2,
      fields_total: 10,
      extraction_confidence: {
        // gpa removed, sat_score set to high
        sat_score: "high",
        city: "medium",
      },
    };

    const fromFn = vi
      .fn()
      .mockReturnValueOnce(makeChain({ data: { role: "coach" } }))
      .mockReturnValueOnce(
        makeChain({
          data: {
            name_key: "alex johnson",
            extraction_confidence: {
              gpa: "medium",
              city: "medium",
              sat_score: "low",
            },
          },
        })
      )
      .mockReturnValueOnce(
        makeChain({ data: updatedRecruitData }, { onUpdate: (data) => (capturedUpdate = data) })
      )
      .mockReturnValueOnce(makeChain({ data: null }))
      .mockReturnValueOnce(makeChain({ data: null }));

    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: fromFn,
    } as never);

    vi.mocked(computeCompletenessMetadata).mockReturnValue({
      fields_missing: ["gpa"],
      fields_extracted: 2,
      fields_total: 10,
    });

    const res = await PUT(makeReq({ gpa: null, sat_score: 1350 }), {
      params: Promise.resolve({ id: "recruit-1" }),
    });

    expect(res.status).toBe(200);
    const updatedConfidence = (capturedUpdate?.extraction_confidence) as Record<string, string>;
    
    // GPA should be removed since it was cleared
    expect(updatedConfidence.gpa).toBeUndefined();
    
    // SAT score should be set to high since it was edited
    expect(updatedConfidence.sat_score).toBe("high");
    
    // Other fields should be preserved
    expect(updatedConfidence.city).toBe("medium");
  });
});

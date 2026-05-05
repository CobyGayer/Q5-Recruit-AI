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

describe("PUT /api/recruits/[id] - manual field edit confidence update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminProgramOverride).mockResolvedValue(null);
    vi.mocked(createAdminClient).mockReturnValue({ from: vi.fn() } as never);
  });

  it("should update extraction_confidence to 'high' when editing a field with existing confidence", async () => {
    let capturedUpdate: Record<string, unknown> | undefined;
    let returnedRecruit: Record<string, unknown> | undefined;

    // Mock the response that will be returned from the first update (after editing)
    const updatedRecruitData = {
      id: "recruit-1",
      program_id: "prog-1",
      gpa: 3.8,
      name_key: "alex johnson",
      fields_missing: [],
      fields_extracted: 2,
      fields_total: 10,
      extraction_confidence: {
        gpa: "high", // Should be updated to "high" after manual edit
        city: "medium",
      },
    };

    const fromFn = vi
      .fn()
      .mockReturnValueOnce(makeChain({ data: { role: "coach" } })) // auth query
      .mockReturnValueOnce(
        makeChain({
          data: {
            name_key: "alex johnson",
            extraction_confidence: {
              gpa: "low", // Original confidence was "low"
              city: "medium",
            },
          },
        })
      ) // pre-fetch query
      .mockReturnValueOnce(
        makeChain({ data: updatedRecruitData }, { onUpdate: (data) => (capturedUpdate = data) })
      ) // update query
      .mockReturnValueOnce(makeChain({ data: null })) // program_config query
      .mockReturnValueOnce(makeChain({ data: null })); // transcript query

    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
      from: fromFn,
    } as never);

    vi.mocked(computeCompletenessMetadata).mockReturnValue({
      fields_missing: [],
      fields_extracted: 2,
      fields_total: 10,
    });

    const res = await PUT(makeReq({ gpa: 3.8 }), {
      params: Promise.resolve({ id: "recruit-1" }),
    });

    returnedRecruit = await res.json();

    expect(res.status).toBe(200);
    expect(capturedUpdate).toBeDefined();
    
    // The update should include the new GPA value
    expect(capturedUpdate?.gpa).toBe(3.8);
    
    // The update should include extraction_confidence with gpa set to "high"
    expect(capturedUpdate?.extraction_confidence).toBeDefined();
    const updatedConfidence = capturedUpdate?.extraction_confidence as Record<string, string>;
    expect(updatedConfidence.gpa).toBe("high");
    
    // The response should include the updated recruit with new confidence
    expect(returnedRecruit?.extraction_confidence).toBeDefined();
    const returnedConfidence = (returnedRecruit?.extraction_confidence) as Record<string, string>;
    expect(returnedConfidence.gpa).toBe("high");
  });

  it("should preserve other field confidences when editing one field", async () => {
    let capturedUpdate: Record<string, unknown> | undefined;

    const updatedRecruitData = {
      id: "recruit-1",
      program_id: "prog-1",
      gpa: 3.9,
      name_key: "alex johnson",
      fields_missing: [],
      fields_extracted: 2,
      fields_total: 10,
      extraction_confidence: {
        gpa: "high",
        city: "medium",
        sat_score: "low",
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
              gpa: "medium", // Original confidence was "medium"
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
      fields_missing: [],
      fields_extracted: 2,
      fields_total: 10,
    });

    await PUT(makeReq({ gpa: 3.9 }), {
      params: Promise.resolve({ id: "recruit-1" }),
    });

    expect(capturedUpdate?.extraction_confidence).toBeDefined();
    const updatedConfidence = capturedUpdate?.extraction_confidence as Record<string, string>;
    
    // GPA should be updated to "high"
    expect(updatedConfidence.gpa).toBe("high");
    
    // Other fields should be preserved
    expect(updatedConfidence.city).toBe("medium");
    expect(updatedConfidence.sat_score).toBe("low");
  });
});

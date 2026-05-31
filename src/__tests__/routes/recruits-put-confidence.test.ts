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

function makePersistedRecruit() {
  return {
    id: "recruit-1",
    program_id: "prog-1",
    name_key: "alex johnson",
    fields_missing: [],
    fields_extracted: 2,
    fields_total: 10,
  };
}

describe("PUT /api/recruits/[id] unknown confidence guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminProgramOverride).mockResolvedValue(null);
    vi.mocked(createAdminClient).mockReturnValue({ from: vi.fn() } as never);
  });

  async function runCase(clubLevelInput: null | "") {
    let capturedUpdate: Record<string, unknown> | undefined;

    const fromFn = vi
      .fn()
      .mockReturnValueOnce(makeChain({ data: { role: "coach" } }))
      .mockReturnValueOnce(
        makeChain({
          data: {
            name_key: "alex johnson",
            extraction_confidence: {
              club_level: "high",
              city: "medium",
            },
          },
        })
      )
      .mockReturnValueOnce(
        makeChain({ data: makePersistedRecruit() }, { onUpdate: (data) => (capturedUpdate = data) })
      )
      .mockReturnValueOnce(makeChain({ data: null }))
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

    const res = await PUT(makeReq({ club_level: clubLevelInput }), {
      params: Promise.resolve({ id: "recruit-1" }),
    });

    return { res, capturedUpdate };
  }

  it("clubLevel null clear (club_level: null) does not stamp high confidence for unknown", async () => {
    const { res, capturedUpdate } = await runCase(null);

    expect(res.status).toBe(200);
    expect(capturedUpdate?.club_level).toBe("unknown");

    const confidence =
      (capturedUpdate?.extraction_confidence as Record<string, string> | undefined) ?? {};
    expect(confidence.club_level).toBeUndefined();
  });

  it("clubLevel empty-string clear (club_level: \"\") does not stamp high confidence for unknown", async () => {
    const { res, capturedUpdate } = await runCase("");

    expect(res.status).toBe(200);
    expect(capturedUpdate?.club_level).toBe("unknown");

    const confidence =
      (capturedUpdate?.extraction_confidence as Record<string, string> | undefined) ?? {};
    expect(confidence.club_level).toBeUndefined();
  });
});

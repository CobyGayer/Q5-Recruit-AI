import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/admin-cookies", () => ({ getAdminProgramOverride: vi.fn() }));
vi.mock("@/lib/data/league-preferences", () => ({
  batchEvaluateOutsideSelectionFlags: vi.fn(),
}));

import { POST } from "@/app/api/recruits/batch-update-league-flags/route";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminProgramOverride } from "@/lib/admin-cookies";
import { batchEvaluateOutsideSelectionFlags } from "@/lib/data/league-preferences";

function makeChain(result: { data?: unknown; error?: unknown } = { data: null }) {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "update", "insert", "delete", "is"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue(result);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
    Promise.resolve(result).then(resolve, reject);
  return chain as unknown;
}

function makeReq(body: unknown) {
  return {
    json: vi.fn().mockResolvedValue(body),
  } as unknown as import("next/server").NextRequest;
}

describe("POST /api/recruits/batch-update-league-flags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminProgramOverride).mockResolvedValue(null);
    vi.mocked(batchEvaluateOutsideSelectionFlags).mockReturnValue([]);
    vi.mocked(createAdminClient).mockReturnValue({ from: vi.fn() } as never);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as never);

    const res = await POST(makeReq({ programId: "f8b03d65-205b-44a0-bf6b-1f53f57bb310" }));
    expect(res.status).toBe(401);
  });

  it("returns 422 on invalid request body", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
      from: vi.fn(),
    } as never);

    const res = await POST(makeReq({ programId: "not-a-uuid" }));
    expect(res.status).toBe(422);
  });

  it("returns 403 when coach cannot access program", async () => {
    const fromFn = vi
      .fn()
      .mockReturnValueOnce(makeChain({ data: { program_id: "other-program" } }));

    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
      from: fromFn,
    } as never);

    const res = await POST(makeReq({ programId: "f8b03d65-205b-44a0-bf6b-1f53f57bb310" }));
    expect(res.status).toBe(403);
  });

  it("returns updated_count 0 when no recruits need updates", async () => {
    const fromFn = vi
      .fn()
      .mockReturnValueOnce(makeChain({ data: { program_id: "f8b03d65-205b-44a0-bf6b-1f53f57bb310" } }))
      .mockReturnValueOnce(makeChain({ data: { league_preferences: ["ecnl"] } }))
      .mockReturnValueOnce(makeChain({
        data: [{ id: "r1", club_level: "ecnl", is_outside_selected_leagues: false }],
      }));

    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
      from: fromFn,
    } as never);

    vi.mocked(batchEvaluateOutsideSelectionFlags).mockReturnValue([]);

    const res = await POST(makeReq({ programId: "f8b03d65-205b-44a0-bf6b-1f53f57bb310" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.updated_count).toBe(0);
  });

  it("batch updates recruits and reports partial failures", async () => {
    const fromFn = vi
      .fn()
      .mockReturnValueOnce(makeChain({ data: { program_id: "f8b03d65-205b-44a0-bf6b-1f53f57bb310" } }))
      .mockReturnValueOnce(makeChain({ data: { league_preferences: ["ecnl"] } }))
      .mockReturnValueOnce(makeChain({
        data: [
          { id: "r1", club_level: "ga", is_outside_selected_leagues: false },
          { id: "r2", club_level: "ecnl", is_outside_selected_leagues: true },
        ],
      }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: { message: "db error" } }));

    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
      from: fromFn,
    } as never);

    vi.mocked(batchEvaluateOutsideSelectionFlags).mockReturnValue([
      { recruitId: "r1", newFlagValue: true },
      { recruitId: "r2", newFlagValue: false },
    ]);

    const res = await POST(makeReq({ programId: "f8b03d65-205b-44a0-bf6b-1f53f57bb310" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.updated_count).toBe(2);
    expect(body.failed_count).toBe(1);
    expect(body.success).toBe(false);
  });
});

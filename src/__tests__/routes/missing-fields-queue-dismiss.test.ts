import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/program-context", () => ({ getEffectiveProgramContext: vi.fn() }));

import { POST } from "@/app/api/recruits/missing-fields-queue/dismiss/route";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveProgramContext } from "@/lib/program-context";

function makeChain(result: { data?: unknown; error?: unknown } = { data: null }) {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq", "not", "in", "limit", "order", "insert", "update", "delete", "is"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue(result);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  chain.upsert = vi.fn().mockResolvedValue({ error: null });
  chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
    Promise.resolve(result).then(resolve, reject);
  return chain as unknown;
}

function makeReq(body?: unknown) {
  return {
    json: body === undefined
      ? vi.fn().mockRejectedValue(new SyntaxError("Bad JSON"))
      : vi.fn().mockResolvedValue(body),
  } as unknown as import("next/server").NextRequest;
}

function setupAuth(db: unknown, user: { id: string } | null = { id: "user-1" }) {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
  } as never);
  vi.mocked(getEffectiveProgramContext).mockResolvedValue(
    user ? { effectiveProgramId: "prog-1", db } as never : null
  );
}

describe("POST /api/recruits/missing-fields-queue/dismiss", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    setupAuth(null, null);
    const res = await POST(makeReq({ queue_id: "q1" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when no program context", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
    } as never);
    vi.mocked(getEffectiveProgramContext).mockResolvedValue(null);
    const res = await POST(makeReq({ queue_id: "q1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON body", async () => {
    setupAuth({ from: vi.fn() });
    const res = await POST(makeReq());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/invalid json/i);
  });

  it("returns 400 when queue_id missing", async () => {
    setupAuth({ from: vi.fn() });
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/queue_id/i);
  });

  it("returns 404 when entry not found", async () => {
    const db = { from: vi.fn().mockReturnValue(makeChain({ data: null })) };
    setupAuth(db);
    const res = await POST(makeReq({ queue_id: "missing" }));
    expect(res.status).toBe(404);
  });

  it("returns 409 when entry already info_requested_at set", async () => {
    const fromFn = vi.fn().mockReturnValueOnce(
      makeChain({ data: { id: "q1", info_requested_at: "2024-01-01T00:00:00Z" } })
    );
    setupAuth({ from: fromFn });
    const res = await POST(makeReq({ queue_id: "q1" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already marked/i);
  });

  it("returns 500 when DB update fails", async () => {
    const fromFn = vi.fn()
      .mockReturnValueOnce(makeChain({ data: { id: "q1", info_requested_at: null } }))
      .mockReturnValueOnce(makeChain({ data: null, error: { message: "db fail" } }));
    setupAuth({ from: fromFn });
    const res = await POST(makeReq({ queue_id: "q1" }));
    expect(res.status).toBe(500);
  });

  it("returns 200 on successful dismiss", async () => {
    const fromFn = vi.fn()
      .mockReturnValueOnce(makeChain({ data: { id: "q1", info_requested_at: null } }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }));
    setupAuth({ from: fromFn });
    const res = await POST(makeReq({ queue_id: "q1" }));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
});

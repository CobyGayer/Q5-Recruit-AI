import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/program-context", () => ({ getEffectiveProgramContext: vi.fn() }));

import { POST } from "@/app/api/recruits/duplicate-review/dismiss/route";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveProgramContext } from "@/lib/program-context";

function makeChain(result: { data?: unknown; error?: unknown } = { data: null }) {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq", "not", "in", "limit", "order", "insert", "update", "delete"]) {
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

describe("POST /api/recruits/duplicate-review/dismiss", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    setupAuth(null, null);
    const res = await POST(makeReq({ group_id: "g1" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when no program context", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
    } as never);
    vi.mocked(getEffectiveProgramContext).mockResolvedValue(null);
    const res = await POST(makeReq({ group_id: "g1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON body", async () => {
    setupAuth({ from: vi.fn() });
    const res = await POST(makeReq()); // no body → json() rejects
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/invalid json/i);
  });

  it("returns 400 when group_id missing from body", async () => {
    setupAuth({ from: vi.fn() });
    const res = await POST(makeReq({})); // body without group_id
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/group_id/i);
  });

  it("returns 404 when group not found in program", async () => {
    const db = { from: vi.fn().mockReturnValue(makeChain({ data: null })) };
    setupAuth(db);
    const res = await POST(makeReq({ group_id: "missing" }));
    expect(res.status).toBe(404);
  });

  it("returns 400 when group is not pending", async () => {
    const fromFn = vi.fn()
      .mockReturnValueOnce(makeChain({ data: { id: "g1", status: "dismissed" } }));
    setupAuth({ from: fromFn });
    const res = await POST(makeReq({ group_id: "g1" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/not pending/i);
  });

  it("returns 200 with success on valid dismiss", async () => {
    const fromFn = vi.fn()
      .mockReturnValueOnce(makeChain({ data: { id: "g1", status: "pending" } })) // fetch group
      .mockReturnValueOnce(makeChain({ data: null, error: null }));               // update
    setupAuth({ from: fromFn });
    const res = await POST(makeReq({ group_id: "g1" }));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it("returns 500 when DB update fails", async () => {
    const fromFn = vi.fn()
      .mockReturnValueOnce(makeChain({ data: { id: "g1", status: "pending" } }))
      .mockReturnValueOnce(makeChain({ data: null, error: { message: "db fail" } }));
    setupAuth({ from: fromFn });
    const res = await POST(makeReq({ group_id: "g1" }));
    expect(res.status).toBe(500);
  });
});

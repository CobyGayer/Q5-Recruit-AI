import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/program-context", () => ({ getEffectiveProgramContext: vi.fn() }));

import { GET } from "@/app/api/recruits/duplicate-review/groups/route";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveProgramContext } from "@/lib/program-context";

function makeChain(result: { data?: unknown; error?: unknown; count?: number } = { data: null }) {
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

function makeReq(searchParams: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/recruits/duplicate-review/groups");
  for (const [k, v] of Object.entries(searchParams)) url.searchParams.set(k, v);
  return { nextUrl: url } as unknown as import("next/server").NextRequest;
}

function setupAuth(db: unknown, user: { id: string } | null = { id: "user-1" }) {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
  } as never);
  vi.mocked(getEffectiveProgramContext).mockResolvedValue(
    user ? { effectiveProgramId: "prog-1", db } as never : null
  );
}

describe("GET /api/recruits/duplicate-review/groups", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    setupAuth(null, null);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns 400 when no program context", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
    } as never);
    vi.mocked(getEffectiveProgramContext).mockResolvedValue(null);
    const res = await GET(makeReq());
    expect(res.status).toBe(400);
  });

  it("count_only=true → returns pending group count", async () => {
    const db = { from: vi.fn().mockReturnValue(makeChain({ count: 3, data: null })) };
    setupAuth(db);
    const res = await GET(makeReq({ count_only: "true" }));
    expect(res.status).toBe(200);
    expect((await res.json()).count).toBe(3);
  });

  it("count_only=true with DB error → returns 500", async () => {
    const db = { from: vi.fn().mockReturnValue(makeChain({ data: null, error: { message: "db fail" } })) };
    setupAuth(db);
    const res = await GET(makeReq({ count_only: "true" }));
    expect(res.status).toBe(500);
  });

  it("no pending groups → returns empty array", async () => {
    const fromFn = vi.fn().mockReturnValueOnce(makeChain({ data: [] }));
    setupAuth({ from: fromFn });
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns groups with hydrated member profiles", async () => {
    const group = { id: "g1", status: "pending", created_at: "2024-01-01" };
    const member = { group_id: "g1", recruit_id: "r1" };
    const recruit = { id: "r1", full_name: "Alex Johnson" };

    const fromFn = vi.fn()
      .mockReturnValueOnce(makeChain({ data: [group] }))    // groups
      .mockReturnValueOnce(makeChain({ data: [member] }))   // members
      .mockReturnValueOnce(makeChain({ data: [recruit] }))  // recruits
      .mockReturnValueOnce(makeChain({ data: [] }));         // ingested_emails

    setupAuth({ from: fromFn });
    const res = await GET(makeReq());
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].id).toBe("g1");
    expect(json[0].members).toHaveLength(1);
    expect(json[0].members[0].full_name).toBe("Alex Johnson");
  });

  it("groups with no members → members array is empty", async () => {
    const group = { id: "g1", status: "pending" };
    const fromFn = vi.fn()
      .mockReturnValueOnce(makeChain({ data: [group] }))  // groups
      .mockReturnValueOnce(makeChain({ data: [] }))        // members: none
      .mockReturnValueOnce(makeChain({ data: [] }));       // recruits: none (empty id set)

    setupAuth({ from: fromFn });
    const res = await GET(makeReq());
    const json = await res.json();
    expect(json[0].members).toHaveLength(0);
  });
});

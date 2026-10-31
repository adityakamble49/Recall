import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getApiPrincipal: vi.fn(),
  hasTrustedSessionMutationOrigin: vi.fn(),
  userLimit: vi.fn(),
  tokenLimit: vi.fn(),
  deleteWhere: vi.fn(),
  insertValues: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/api-auth", () => ({
  getApiPrincipal: mocks.getApiPrincipal,
  hasTrustedSessionMutationOrigin: mocks.hasTrustedSessionMutationOrigin,
}));
vi.mock("@/lib/db/schema", () => ({
  users: { id: "users.id", email: "users.email" },
  apiTokens: { token: "api_tokens.token", userId: "api_tokens.user_id" },
}));
vi.mock("@/lib/db", () => ({
  db: {
    // The first select reads the user's email, any later one reads the token.
    select: (fields: Record<string, unknown>) => ({
      from: () => ({
        where: () => ({ limit: "email" in fields ? mocks.userLimit : mocks.tokenLimit }),
      }),
    }),
    delete: () => ({ where: mocks.deleteWhere }),
    insert: () => ({ values: mocks.insertValues }),
  },
}));

import { GET, POST } from "@/app/api/token/route";

function request(origin?: string) {
  return new NextRequest("https://recall.ltd/api/token", {
    method: "POST",
    headers: origin ? { origin } : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("RECALL_API_TOKEN_EMAILS", "allowed@example.com");
  mocks.auth.mockResolvedValue({ user: { id: "user-a" } });
  mocks.getApiPrincipal.mockResolvedValue({ userId: "user-a", authType: "session" });
  mocks.hasTrustedSessionMutationOrigin.mockReturnValue(true);
  mocks.userLimit.mockResolvedValue([{ email: "Allowed@Example.com" }]);
  mocks.tokenLimit.mockResolvedValue([{ token: "recall_existing" }]);
  mocks.deleteWhere.mockResolvedValue(undefined);
  mocks.insertValues.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/token", () => {
  it("rejects an untrusted session origin before rotating the token", async () => {
    mocks.hasTrustedSessionMutationOrigin.mockReturnValue(false);

    const response = await POST(request("https://attacker.example"));

    expect(response.status).toBe(403);
    expect(mocks.deleteWhere).not.toHaveBeenCalled();
    expect(mocks.insertValues).not.toHaveBeenCalled();
  });

  it.each(["extension", "personal-token"] as const)(
    "does not allow an explicit %s credential to generate personal tokens",
    async (authType) => {
      mocks.getApiPrincipal.mockResolvedValue({ userId: "user-a", authType });

      const response = await POST(request());

      expect(response.status).toBe(401);
      expect(mocks.deleteWhere).not.toHaveBeenCalled();
    },
  );

  it("rotates a token for an allowlisted, trusted browser session", async () => {
    const response = await POST(request("https://recall.ltd"));

    expect(response.status).toBe(200);
    expect((await response.json()).token).toMatch(/^recall_[a-f0-9]{32}$/);
    expect(mocks.deleteWhere).toHaveBeenCalledOnce();
    expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-a" }));
  });

  it("rejects a user whose email is not allowlisted", async () => {
    mocks.userLimit.mockResolvedValue([{ email: "other@example.com" }]);

    const response = await POST(request("https://recall.ltd"));

    expect(response.status).toBe(403);
    expect(mocks.deleteWhere).not.toHaveBeenCalled();
    expect(mocks.insertValues).not.toHaveBeenCalled();
  });

  it("rejects everyone when the allowlist is unset", async () => {
    vi.stubEnv("RECALL_API_TOKEN_EMAILS", "");

    const response = await POST(request("https://recall.ltd"));

    expect(response.status).toBe(403);
    expect(mocks.insertValues).not.toHaveBeenCalled();
  });
});

describe("GET /api/token", () => {
  it("returns the token for an allowlisted user", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ token: "recall_existing" });
  });

  it("returns 403 without reading the token for a user who is not allowlisted", async () => {
    mocks.userLimit.mockResolvedValue([{ email: "other@example.com" }]);

    const response = await GET();

    expect(response.status).toBe(403);
    expect(mocks.tokenLimit).not.toHaveBeenCalled();
  });

  it("returns 401 when signed out", async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mocks.userLimit).not.toHaveBeenCalled();
  });
});

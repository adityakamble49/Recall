import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getApiPrincipal: vi.fn(),
  hasTrustedSessionMutationOrigin: vi.fn(),
  hasFeatureFlag: vi.fn(),
  deleteWhere: vi.fn(),
  insertValues: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/api-auth", () => ({
  getApiPrincipal: mocks.getApiPrincipal,
  hasTrustedSessionMutationOrigin: mocks.hasTrustedSessionMutationOrigin,
}));
vi.mock("@/lib/feature-flags", () => ({
  FLAGS: { API_TOKENS: "api_tokens" },
  hasFeatureFlag: mocks.hasFeatureFlag,
}));
vi.mock("@/lib/db", () => ({
  db: {
    delete: () => ({ where: mocks.deleteWhere }),
    insert: () => ({ values: mocks.insertValues }),
  },
}));

import { POST } from "@/app/api/token/route";

function request(origin?: string) {
  return new NextRequest("https://recall.ltd/api/token", {
    method: "POST",
    headers: origin ? { origin } : undefined,
  });
}

describe("POST /api/token mutation origin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApiPrincipal.mockResolvedValue({ userId: "user-a", authType: "session" });
    mocks.hasTrustedSessionMutationOrigin.mockReturnValue(true);
    mocks.hasFeatureFlag.mockResolvedValue(true);
    mocks.deleteWhere.mockResolvedValue(undefined);
    mocks.insertValues.mockResolvedValue(undefined);
  });

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

  it("rotates a token for a trusted browser session", async () => {
    const response = await POST(request("https://recall.ltd"));

    expect(response.status).toBe(200);
    expect((await response.json()).token).toMatch(/^recall_[a-f0-9]{32}$/);
    expect(mocks.deleteWhere).toHaveBeenCalledOnce();
    expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-a" }));
  });
});

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiPrincipal: vi.fn(),
  getApiUser: vi.fn(),
  hasTrustedSessionMutationOrigin: vi.fn(),
  selectLimit: vi.fn(),
  insertReturning: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  getApiPrincipal: mocks.getApiPrincipal,
  getApiUser: mocks.getApiUser,
  hasTrustedSessionMutationOrigin: mocks.hasTrustedSessionMutationOrigin,
}));
vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: mocks.selectLimit }),
      }),
    }),
    insert: () => ({
      values: () => ({ returning: mocks.insertReturning }),
    }),
  },
}));

import { POST } from "@/app/api/collections/route";

function request(origin?: string) {
  return new NextRequest("https://recall.ltd/api/collections", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(origin ? { origin } : {}),
    },
    body: JSON.stringify({ name: "Security" }),
  });
}

describe("POST /api/collections mutation origin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApiPrincipal.mockResolvedValue({ userId: "user-a", authType: "extension" });
    mocks.hasTrustedSessionMutationOrigin.mockReturnValue(true);
    mocks.selectLimit.mockResolvedValue([]);
    mocks.insertReturning.mockResolvedValue([{ id: 7 }]);
  });

  it("rejects an untrusted cookie-authenticated request before database access", async () => {
    mocks.getApiPrincipal.mockResolvedValue({ userId: "user-a", authType: "session" });
    mocks.hasTrustedSessionMutationOrigin.mockReturnValue(false);

    const response = await POST(request("https://attacker.example"));

    expect(response.status).toBe(403);
    expect(mocks.selectLimit).not.toHaveBeenCalled();
    expect(mocks.insertReturning).not.toHaveBeenCalled();
  });

  it("accepts an exact trusted origin for a browser session", async () => {
    mocks.getApiPrincipal.mockResolvedValue({ userId: "user-a", authType: "session" });

    const response = await POST(request("https://recall.ltd"));

    expect(response.status).toBe(200);
    expect(mocks.hasTrustedSessionMutationOrigin).toHaveBeenCalledOnce();
  });

  it.each(["extension", "personal-token"] as const)(
    "does not apply cookie CSRF checks to an explicit %s credential",
    async (authType) => {
      mocks.getApiPrincipal.mockResolvedValue({ userId: "user-a", authType });

      const response = await POST(request());

      expect(response.status).toBe(200);
      expect(mocks.hasTrustedSessionMutationOrigin).not.toHaveBeenCalled();
    },
  );
});

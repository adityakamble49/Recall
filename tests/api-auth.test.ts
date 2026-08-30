import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  authenticateExtensionBearer: vi.fn(),
  headerValues: new Map<string, string>(),
  selectLimit: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: (name: string) => mocks.headerValues.get(name.toLowerCase()) ?? null,
  })),
}));
vi.mock("@/lib/extension-auth", () => ({
  authenticateExtensionBearer: mocks.authenticateExtensionBearer,
}));
vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: mocks.selectLimit }),
      }),
    }),
  },
}));
vi.mock("@/lib/db/schema", () => ({
  apiTokens: { token: "token", userId: "userId" },
}));

import { getApiPrincipal, getApiUser, hasTrustedSessionMutationOrigin } from "@/lib/api-auth";

describe("API authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headerValues.clear();
    mocks.auth.mockResolvedValue(null);
    mocks.authenticateExtensionBearer.mockResolvedValue(null);
    mocks.selectLimit.mockResolvedValue([]);
  });

  it("uses the authenticated web session when no explicit credential is supplied", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "web-user" } });

    await expect(getApiPrincipal("bookmarks:write")).resolves.toEqual({
      userId: "web-user",
      authType: "session",
    });
    expect(mocks.authenticateExtensionBearer).not.toHaveBeenCalled();
  });

  it("passes the required scope to extension authentication", async () => {
    const token = `recall_ext_${"a".repeat(32)}.${"b".repeat(43)}`;
    mocks.headerValues.set("authorization", `Bearer ${token}`);
    mocks.authenticateExtensionBearer.mockResolvedValue({ userId: "extension-user" });

    await expect(getApiPrincipal("collections:read")).resolves.toEqual({
      userId: "extension-user",
      authType: "extension",
    });
    expect(mocks.authenticateExtensionBearer).toHaveBeenCalledWith(
      `Bearer ${token}`,
      "collections:read",
    );
  });

  it("does not reinterpret a rejected extension credential as a personal token", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "web-user" } });
    mocks.headerValues.set("authorization", `Bearer recall_ext_${"a".repeat(32)}.${"b".repeat(43)}`);

    await expect(getApiPrincipal("bookmarks:read")).resolves.toBeNull();
    expect(mocks.selectLimit).not.toHaveBeenCalled();
    expect(mocks.auth).not.toHaveBeenCalled();
  });

  it("does not fall back to a valid browser session after any invalid bearer credential", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "web-user" } });
    mocks.headerValues.set("authorization", "Bearer invalid-personal-token");

    await expect(getApiPrincipal()).resolves.toBeNull();
    expect(mocks.auth).not.toHaveBeenCalled();
  });

  it("ignores the removed website-session header", async () => {
    mocks.headerValues.set("x-session-token", "website-session-secret");

    await expect(getApiUser()).resolves.toBeNull();
    expect(mocks.selectLimit).not.toHaveBeenCalled();
  });

  it("keeps personal bearer tokens available for API clients", async () => {
    mocks.headerValues.set("authorization", "Bearer personal-token");
    mocks.selectLimit.mockResolvedValue([{ userId: "mobile-user" }]);

    await expect(getApiPrincipal()).resolves.toEqual({
      userId: "mobile-user",
      authType: "personal-token",
    });
  });

  it("keeps the user-only compatibility helper", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "web-user" } });

    await expect(getApiUser()).resolves.toBe("web-user");
  });
});

describe("session mutation origins", () => {
  function request(origin?: string) {
    return new NextRequest("https://recall.ltd/api/bookmarks", {
      method: "POST",
      headers: origin ? { origin } : undefined,
    });
  }

  it("accepts only an exact allowlisted origin", () => {
    expect(hasTrustedSessionMutationOrigin(
      request("https://recall.ltd"),
      ["https://recall.ltd"],
    )).toBe(true);
  });

  it.each([
    ["missing", undefined],
    ["foreign", "https://attacker.example"],
    ["same-site subdomain", "https://evil.recall.ltd"],
    ["origin with path", "https://recall.ltd/attack"],
    ["malformed", "not an origin"],
  ])("rejects a %s origin", (_label, origin) => {
    expect(hasTrustedSessionMutationOrigin(
      request(origin),
      ["https://recall.ltd"],
    )).toBe(false);
  });
});

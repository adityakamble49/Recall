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

import { getApiUser } from "@/lib/api-auth";

describe("getApiUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headerValues.clear();
    mocks.auth.mockResolvedValue(null);
    mocks.authenticateExtensionBearer.mockResolvedValue(null);
    mocks.selectLimit.mockResolvedValue([]);
  });

  it("prefers the authenticated web session", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "web-user" } });

    await expect(getApiUser("bookmarks:write")).resolves.toBe("web-user");
    expect(mocks.authenticateExtensionBearer).not.toHaveBeenCalled();
  });

  it("passes the required scope to extension authentication", async () => {
    const token = `recall_ext_${"a".repeat(32)}.${"b".repeat(43)}`;
    mocks.headerValues.set("authorization", `Bearer ${token}`);
    mocks.authenticateExtensionBearer.mockResolvedValue({ userId: "extension-user" });

    await expect(getApiUser("collections:read")).resolves.toBe("extension-user");
    expect(mocks.authenticateExtensionBearer).toHaveBeenCalledWith(
      `Bearer ${token}`,
      "collections:read",
    );
  });

  it("does not reinterpret a rejected extension credential as a personal token", async () => {
    mocks.headerValues.set("authorization", `Bearer recall_ext_${"a".repeat(32)}.${"b".repeat(43)}`);

    await expect(getApiUser("bookmarks:read")).resolves.toBeNull();
    expect(mocks.selectLimit).not.toHaveBeenCalled();
  });

  it("ignores the removed website-session header", async () => {
    mocks.headerValues.set("x-session-token", "website-session-secret");

    await expect(getApiUser()).resolves.toBeNull();
    expect(mocks.selectLimit).not.toHaveBeenCalled();
  });

  it("keeps personal bearer tokens available for API clients", async () => {
    mocks.headerValues.set("authorization", "Bearer personal-token");
    mocks.selectLimit.mockResolvedValue([{ userId: "mobile-user" }]);

    await expect(getApiUser()).resolves.toBe("mobile-user");
  });
});

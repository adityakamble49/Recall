import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  insertValues: vi.fn(),
  selectLimit: vi.fn(),
  updateReturning: vi.fn(),
  updateWhere: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    insert: () => ({ values: mocks.insertValues }),
    select: () => ({ from: () => ({ where: () => ({ limit: mocks.selectLimit }) }) }),
    update: () => ({
      set: () => ({
        where: (...args: unknown[]) => {
          mocks.updateWhere(...args);
          return { returning: mocks.updateReturning };
        },
      }),
    }),
  },
}));

import {
  authenticateExtensionBearer,
  exchangeExtensionAuthorizationCode,
  hashExtensionSecret,
  issueExtensionAuthorizationCode,
  validateExtensionAuthorizationRequest,
} from "@/lib/extension-auth";

const EXTENSION_ID = "mifdhnokgeipckgedpbnccdlllpdpcel";
const REDIRECT_URI = `https://${EXTENSION_ID}.chromiumapp.org/recall-auth`;
const VALID_REQUEST = {
  redirectUri: REDIRECT_URI,
  state: "s".repeat(43),
  codeChallenge: "c".repeat(43),
  codeChallengeMethod: "S256",
};

describe("extension authorization request validation", () => {
  it("accepts only the exact allowlisted Store extension redirect", () => {
    expect(validateExtensionAuthorizationRequest(VALID_REQUEST, [EXTENSION_ID])).toEqual({
      valid: true,
      extensionId: EXTENSION_ID,
    });
  });

  it.each([
    ["unknown extension", { ...VALID_REQUEST, redirectUri: `https://${"a".repeat(32)}.chromiumapp.org/recall-auth` }],
    ["redirect path", { ...VALID_REQUEST, redirectUri: `https://${EXTENSION_ID}.chromiumapp.org/other` }],
    ["redirect query", { ...VALID_REQUEST, redirectUri: `${REDIRECT_URI}?next=evil` }],
    ["PKCE method", { ...VALID_REQUEST, codeChallengeMethod: "plain" }],
    ["short state", { ...VALID_REQUEST, state: "short" }],
  ])("rejects an invalid %s", (_label, request) => {
    expect(validateExtensionAuthorizationRequest(request, [EXTENSION_ID]).valid).toBe(false);
  });
});

describe("extension authorization credentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insertValues.mockResolvedValue(undefined);
    mocks.updateReturning.mockResolvedValue([]);
  });

  it("stores only a hash of a short-lived authorization code", async () => {
    const now = new Date("2026-08-29T12:00:00.000Z");

    const code = await issueExtensionAuthorizationCode("user-a", VALID_REQUEST, now);

    expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-a",
      codeHash: await hashExtensionSecret(code),
      expiresAt: new Date("2026-08-29T12:05:00.000Z"),
    }));
    expect(JSON.stringify(mocks.insertValues.mock.calls[0][0])).not.toContain(code);
  });

  it("atomically consumes a PKCE code and stores only the credential secret hash", async () => {
    const now = new Date("2026-08-29T12:00:00.000Z");
    const code = "c".repeat(43);
    const verifier = "v".repeat(43);
    mocks.selectLimit.mockResolvedValue([{
      userId: "user-a",
      codeChallenge: await hashExtensionSecret(verifier),
      redirectUri: REDIRECT_URI,
      expiresAt: new Date("2026-08-29T12:05:00.000Z"),
      usedAt: null,
    }]);
    mocks.updateReturning.mockResolvedValue([{ userId: "user-a" }]);

    const result = await exchangeExtensionAuthorizationCode({ code, codeVerifier: verifier, redirectUri: REDIRECT_URI }, now);

    expect(result?.accessToken).toMatch(/^recall_ext_[a-f0-9]{32}\.[A-Za-z0-9_-]{43}$/);
    const insertedCredential = mocks.insertValues.mock.calls[0][0];
    const secret = result?.accessToken.split(".")[1] ?? "";
    expect(insertedCredential.secretHash).toBe(await hashExtensionSecret(secret));
    expect(JSON.stringify(insertedCredential)).not.toContain(secret);
    expect(insertedCredential.expiresAt).toEqual(new Date("2026-11-27T12:00:00.000Z"));
  });

  it("rejects a replay when the atomic consume loses the race", async () => {
    const now = new Date("2026-08-29T12:00:00.000Z");
    const verifier = "v".repeat(43);
    mocks.selectLimit.mockResolvedValue([{
      userId: "user-a",
      codeChallenge: await hashExtensionSecret(verifier),
      redirectUri: REDIRECT_URI,
      expiresAt: new Date("2026-08-29T12:05:00.000Z"),
      usedAt: null,
    }]);
    mocks.updateReturning.mockResolvedValue([]);

    const result = await exchangeExtensionAuthorizationCode({
      code: "c".repeat(43),
      codeVerifier: verifier,
      redirectUri: REDIRECT_URI,
    }, now);

    expect(result).toBeNull();
    expect(mocks.insertValues).not.toHaveBeenCalled();
  });

  it("enforces the credential's scopes", async () => {
    const secret = "b".repeat(43);
    mocks.selectLimit.mockResolvedValue([{
      id: 7,
      userId: "user-a",
      scopes: "bookmarks:read",
    }]);

    const principal = await authenticateExtensionBearer(
      `Bearer recall_ext_${"a".repeat(32)}.${secret}`,
      "bookmarks:read",
    );
    const rejected = await authenticateExtensionBearer(
      `Bearer recall_ext_${"a".repeat(32)}.${secret}`,
      "bookmarks:write",
    );

    expect(principal).toEqual(expect.objectContaining({ userId: "user-a", credentialId: 7 }));
    expect(rejected).toBeNull();
  });
});

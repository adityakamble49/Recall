import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticateExtensionBearer: vi.fn(),
  exchangeExtensionAuthorizationCode: vi.fn(),
  revokeExtensionCredential: vi.fn(),
}));

vi.mock("@/lib/extension-auth", () => ({
  authenticateExtensionBearer: mocks.authenticateExtensionBearer,
  configuredExtensionIds: () => ["mifdhnokgeipckgedpbnccdlllpdpcel"],
  exchangeExtensionAuthorizationCode: mocks.exchangeExtensionAuthorizationCode,
  revokeExtensionCredential: mocks.revokeExtensionCredential,
  validateExtensionAuthorizationRequest: vi.fn(() => ({
    valid: true,
    extensionId: "mifdhnokgeipckgedpbnccdlllpdpcel",
  })),
}));

import { DELETE, POST } from "@/app/api/extension/token/route";

const EXTENSION_ID = "mifdhnokgeipckgedpbnccdlllpdpcel";
const ORIGIN = `chrome-extension://${EXTENSION_ID}`;
const REDIRECT_URI = `https://${EXTENSION_ID}.chromiumapp.org/recall-auth`;

function tokenRequest(method: "POST" | "DELETE", body?: unknown, origin = ORIGIN) {
  return new NextRequest("https://recall.ltd/api/extension/token", {
    method,
    headers: {
      origin,
      authorization: `Bearer recall_ext_${"a".repeat(32)}.${"b".repeat(43)}`,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("extension token endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.revokeExtensionCredential.mockResolvedValue(undefined);
  });

  it("exchanges a code only for the allowlisted extension origin and redirect", async () => {
    mocks.exchangeExtensionAuthorizationCode.mockResolvedValue({
      accessToken: `recall_ext_${"a".repeat(32)}.${"b".repeat(43)}`,
      expiresAt: new Date("2026-11-27T12:00:00.000Z"),
    });

    const response = await POST(tokenRequest("POST", {
      code: "c".repeat(43),
      code_verifier: "v".repeat(43),
      redirect_uri: REDIRECT_URI,
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual(expect.objectContaining({
      token_type: "Bearer",
      expires_at: "2026-11-27T12:00:00.000Z",
    }));
  });

  it("rejects an untrusted extension origin before exchanging a code", async () => {
    const response = await POST(tokenRequest("POST", {
      code: "c".repeat(43),
      code_verifier: "v".repeat(43),
      redirect_uri: REDIRECT_URI,
    }, `chrome-extension://${"a".repeat(32)}`));

    expect(response.status).toBe(403);
    expect(mocks.exchangeExtensionAuthorizationCode).not.toHaveBeenCalled();
  });

  it("does not allow the code to choose a different callback path", async () => {
    const response = await POST(tokenRequest("POST", {
      code: "c".repeat(43),
      code_verifier: "v".repeat(43),
      redirect_uri: `https://${EXTENSION_ID}.chromiumapp.org/other`,
    }));

    expect(response.status).toBe(403);
    expect(mocks.exchangeExtensionAuthorizationCode).not.toHaveBeenCalled();
  });

  it("revokes only the authenticated extension credential", async () => {
    mocks.authenticateExtensionBearer.mockResolvedValue({
      credentialId: 9,
      publicId: "a".repeat(32),
      userId: "user-a",
      scopes: ["bookmarks:read"],
    });

    const response = await DELETE(tokenRequest("DELETE"));

    expect(response.status).toBe(204);
    expect(mocks.revokeExtensionCredential).toHaveBeenCalledWith(9, "user-a");
  });
});

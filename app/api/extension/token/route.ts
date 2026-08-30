import { NextRequest, NextResponse } from "next/server";

import {
  authenticateExtensionBearer,
  configuredExtensionIds,
  exchangeExtensionAuthorizationCode,
  revokeExtensionCredential,
  validateExtensionAuthorizationRequest,
} from "@/lib/extension-auth";

export async function POST(request: NextRequest) {
  const body = await parseJson(request);
  if (!body) return errorResponse("Invalid request", 400);

  const code = typeof body.code === "string" ? body.code : "";
  const codeVerifier = typeof body.code_verifier === "string" ? body.code_verifier : "";
  const redirectUri = typeof body.redirect_uri === "string" ? body.redirect_uri : "";
  if (!isAllowedExtensionOrigin(request.headers.get("origin"), redirectUri)) {
    return errorResponse("Extension is not allowed", 403);
  }

  const result = await exchangeExtensionAuthorizationCode({ code, codeVerifier, redirectUri });
  if (!result) return errorResponse("Invalid or expired authorization code", 400);

  return NextResponse.json({
    access_token: result.accessToken,
    token_type: "Bearer",
    expires_at: result.expiresAt.toISOString(),
    scope: "bookmarks:read bookmarks:write collections:read collections:write",
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function DELETE(request: NextRequest) {
  const redirectUri = redirectUriForOrigin(request.headers.get("origin"));
  if (!redirectUri) return errorResponse("Extension is not allowed", 403);

  const principal = await authenticateExtensionBearer(request.headers.get("authorization"));
  if (!principal) return errorResponse("Unauthorized", 401);

  await revokeExtensionCredential(principal.credentialId, principal.userId);
  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}

function isAllowedExtensionOrigin(origin: string | null, redirectUri: string): boolean {
  const expectedRedirect = redirectUriForOrigin(origin);
  if (!expectedRedirect || expectedRedirect !== redirectUri) return false;
  return validateExtensionAuthorizationRequest({
    redirectUri,
    state: "a".repeat(32),
    codeChallenge: "a".repeat(43),
    codeChallengeMethod: "S256",
  }).valid;
}

function redirectUriForOrigin(origin: string | null): string | null {
  const match = origin?.match(/^chrome-extension:\/\/([a-p]{32})$/);
  const extensionId = match?.[1];
  if (!extensionId || !configuredExtensionIds().includes(extensionId)) return null;
  return `https://${extensionId}.chromiumapp.org/recall-auth`;
}

async function parseJson(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

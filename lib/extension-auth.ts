import { Buffer } from "node:buffer";
import { and, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { extensionAuthCodes, extensionCredentials } from "@/lib/db/schema";

export const EXTENSION_SCOPES = [
  "bookmarks:read",
  "bookmarks:write",
  "collections:read",
  "collections:write",
] as const;

export type ExtensionScope = typeof EXTENSION_SCOPES[number];

const AUTH_CODE_TTL_MS = 5 * 60 * 1000;
const CREDENTIAL_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const EXTENSION_TOKEN_PATTERN = /^recall_ext_([a-f0-9]{32})\.([A-Za-z0-9_-]{43})$/;
const EXTENSION_ID_PATTERN = /^[a-p]{32}$/;
const PKCE_VALUE_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;
const STATE_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

export type ExtensionAuthorizationRequest = {
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
};

export type ExtensionPrincipal = {
  credentialId: number;
  publicId: string;
  userId: string;
  scopes: ExtensionScope[];
};

export function configuredExtensionIds(): string[] {
  return (process.env.RECALL_EXTENSION_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => EXTENSION_ID_PATTERN.test(value));
}

export function validateExtensionAuthorizationRequest(
  request: ExtensionAuthorizationRequest,
  allowedExtensionIds = configuredExtensionIds(),
): { valid: true; extensionId: string } | { valid: false; error: string } {
  if (request.codeChallengeMethod !== "S256" || !PKCE_VALUE_PATTERN.test(request.codeChallenge)) {
    return { valid: false, error: "Invalid PKCE challenge" };
  }
  if (!STATE_PATTERN.test(request.state)) {
    return { valid: false, error: "Invalid authorization state" };
  }

  let redirect: URL;
  try {
    redirect = new URL(request.redirectUri);
  } catch {
    return { valid: false, error: "Invalid extension redirect" };
  }

  const hostnameMatch = redirect.hostname.match(/^([a-p]{32})\.chromiumapp\.org$/);
  const extensionId = hostnameMatch?.[1];
  const isExactRedirect = redirect.protocol === "https:"
    && redirect.pathname === "/recall-auth"
    && redirect.search === ""
    && redirect.hash === ""
    && redirect.username === ""
    && redirect.password === "";
  if (!extensionId || !isExactRedirect || !allowedExtensionIds.includes(extensionId)) {
    return { valid: false, error: "Extension is not allowed" };
  }

  return { valid: true, extensionId };
}

export async function hashExtensionSecret(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Buffer.from(digest).toString("base64url");
}

export async function issueExtensionAuthorizationCode(
  userId: string,
  request: ExtensionAuthorizationRequest,
  now = new Date(),
): Promise<string> {
  const code = randomBase64Url(32);
  await db.insert(extensionAuthCodes).values({
    codeHash: await hashExtensionSecret(code),
    userId,
    codeChallenge: request.codeChallenge,
    redirectUri: request.redirectUri,
    expiresAt: new Date(now.getTime() + AUTH_CODE_TTL_MS),
  });
  return code;
}

export async function exchangeExtensionAuthorizationCode(
  { code, codeVerifier, redirectUri }: { code: string; codeVerifier: string; redirectUri: string },
  now = new Date(),
): Promise<{ accessToken: string; expiresAt: Date } | null> {
  if (!PKCE_VALUE_PATTERN.test(code) || !PKCE_VALUE_PATTERN.test(codeVerifier)) return null;

  const codeHash = await hashExtensionSecret(code);
  const [authorization] = await db.select({
    userId: extensionAuthCodes.userId,
    codeChallenge: extensionAuthCodes.codeChallenge,
    redirectUri: extensionAuthCodes.redirectUri,
    expiresAt: extensionAuthCodes.expiresAt,
    usedAt: extensionAuthCodes.usedAt,
  }).from(extensionAuthCodes).where(eq(extensionAuthCodes.codeHash, codeHash)).limit(1);

  if (!authorization
    || authorization.usedAt
    || authorization.expiresAt <= now
    || authorization.redirectUri !== redirectUri
    || authorization.codeChallenge !== await hashExtensionSecret(codeVerifier)) {
    return null;
  }

  const [consumed] = await db.update(extensionAuthCodes)
    .set({ usedAt: now })
    .where(and(
      eq(extensionAuthCodes.codeHash, codeHash),
      isNull(extensionAuthCodes.usedAt),
      gt(extensionAuthCodes.expiresAt, now),
    ))
    .returning({ userId: extensionAuthCodes.userId });
  if (!consumed) return null;

  const publicId = randomHex(16);
  const secret = randomBase64Url(32);
  const expiresAt = new Date(now.getTime() + CREDENTIAL_TTL_MS);
  await db.insert(extensionCredentials).values({
    publicId,
    secretHash: await hashExtensionSecret(secret),
    userId: consumed.userId,
    scopes: EXTENSION_SCOPES.join(" "),
    expiresAt,
  });

  return { accessToken: `recall_ext_${publicId}.${secret}`, expiresAt };
}

export async function authenticateExtensionBearer(
  authorizationHeader: string | null,
  requiredScope?: ExtensionScope,
  now = new Date(),
): Promise<ExtensionPrincipal | null> {
  if (!authorizationHeader?.startsWith("Bearer ")) return null;
  const token = authorizationHeader.slice(7);
  const match = token.match(EXTENSION_TOKEN_PATTERN);
  if (!match) return null;
  const [, publicId, secret] = match;

  const [credential] = await db.select({
    id: extensionCredentials.id,
    userId: extensionCredentials.userId,
    scopes: extensionCredentials.scopes,
  }).from(extensionCredentials).where(and(
    eq(extensionCredentials.publicId, publicId),
    eq(extensionCredentials.secretHash, await hashExtensionSecret(secret)),
    isNull(extensionCredentials.revokedAt),
    gt(extensionCredentials.expiresAt, now),
  )).limit(1);
  if (!credential) return null;

  const scopes = credential.scopes.split(" ")
    .filter((scope): scope is ExtensionScope => EXTENSION_SCOPES.includes(scope as ExtensionScope));
  if (requiredScope && !scopes.includes(requiredScope)) return null;

  return { credentialId: credential.id, publicId, userId: credential.userId, scopes };
}

export async function revokeExtensionCredential(credentialId: number, userId: string, now = new Date()) {
  await db.update(extensionCredentials)
    .set({ revokedAt: now })
    .where(and(eq(extensionCredentials.id, credentialId), eq(extensionCredentials.userId, userId)));
}

export async function listActiveExtensionCredentials(userId: string, now = new Date()) {
  return db.select({
    id: extensionCredentials.id,
    name: extensionCredentials.name,
    createdAt: extensionCredentials.createdAt,
    expiresAt: extensionCredentials.expiresAt,
    lastUsedAt: extensionCredentials.lastUsedAt,
  }).from(extensionCredentials).where(and(
    eq(extensionCredentials.userId, userId),
    isNull(extensionCredentials.revokedAt),
    gt(extensionCredentials.expiresAt, now),
  ));
}

function randomBase64Url(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return Buffer.from(bytes).toString("base64url");
}

function randomHex(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

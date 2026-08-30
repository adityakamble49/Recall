import { auth } from "@/auth";
import { db } from "@/lib/db";
import { apiTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { authenticateExtensionBearer, type ExtensionScope } from "@/lib/extension-auth";
import { DEVELOPMENT_WEB_ORIGIN, PRODUCTION_WEB_ORIGIN } from "@/lib/app-config";

export type ApiPrincipal = {
  userId: string;
  authType: "session" | "extension" | "personal-token";
};

export async function getApiPrincipal(requiredScope?: ExtensionScope): Promise<ApiPrincipal | null> {
  const headersList = await headers();
  const authHeader = headersList.get("authorization");

  // An explicit credential determines the caller. Never fall back to an ambient
  // browser session when a supplied bearer credential is invalid.
  if (authHeader !== null) {
    const extensionPrincipal = await authenticateExtensionBearer(authHeader, requiredScope);
    if (extensionPrincipal) {
      return { userId: extensionPrincipal.userId, authType: "extension" };
    }
    if (authHeader.startsWith("Bearer recall_ext_")) return null;

    // Personal bearer tokens support API/mobile clients.
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const [row] = await db.select({ userId: apiTokens.userId })
        .from(apiTokens)
        .where(eq(apiTokens.token, token))
        .limit(1);
      if (row?.userId) return { userId: row.userId, authType: "personal-token" };
    }
    return null;
  }

  const session = await auth();
  if (session?.user?.id) return { userId: session.user.id, authType: "session" };
  return null;
}

export async function getApiUser(requiredScope?: ExtensionScope): Promise<string | null> {
  return (await getApiPrincipal(requiredScope))?.userId ?? null;
}

export function hasTrustedSessionMutationOrigin(
  request: NextRequest,
  allowedOrigins = defaultTrustedWebOrigins(),
): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const parsed = new URL(origin);
    return parsed.origin === origin && allowedOrigins.includes(origin);
  } catch {
    return false;
  }
}

function defaultTrustedWebOrigins(): string[] {
  return process.env.NODE_ENV === "production"
    ? [PRODUCTION_WEB_ORIGIN]
    : [DEVELOPMENT_WEB_ORIGIN];
}

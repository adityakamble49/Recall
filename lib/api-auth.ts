import { auth } from "@/auth";
import { db } from "@/lib/db";
import { apiTokens, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";

/**
 * Returns userId from either NextAuth session or Bearer token.
 * Used by API routes to support both webapp and Chrome extension.
 */
export async function getApiUser(): Promise<string | null> {
  // Try session first
  const session = await auth();
  if (session?.user?.id) return session.user.id;

  // Try bearer token
  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const [row] = await (db as any).select({ userId: apiTokens.userId })
    .from(apiTokens)
    .where(eq(apiTokens.token, token))
    .limit(1);

  return row?.userId ?? null;
}

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { apiTokens, sessions } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { headers } from "next/headers";

export async function getApiUser(): Promise<string | null> {
  const session = await auth();
  if (session?.user?.id) return session.user.id;

  const headersList = await headers();

  // Try extension session token (from chrome.cookies)
  const sessionToken = headersList.get("x-session-token");
  if (sessionToken) {
    const [row] = await (db as any).select({ userId: sessions.userId })
      .from(sessions)
      .where(and(eq(sessions.sessionToken, sessionToken), gt(sessions.expires, new Date())))
      .limit(1);
    if (row?.userId) return row.userId;
  }

  // Try bearer token (API / mobile)
  const authHeader = headersList.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const [row] = await (db as any).select({ userId: apiTokens.userId })
      .from(apiTokens)
      .where(eq(apiTokens.token, token))
      .limit(1);
    if (row?.userId) return row.userId;
  }

  return null;
}

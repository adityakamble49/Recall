import { auth } from "@/auth";
import { db } from "@/lib/db";
import { apiTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { authenticateExtensionBearer, type ExtensionScope } from "@/lib/extension-auth";

export async function getApiUser(requiredScope?: ExtensionScope): Promise<string | null> {
  const session = await auth();
  if (session?.user?.id) return session.user.id;

  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  const extensionPrincipal = await authenticateExtensionBearer(authHeader, requiredScope);
  if (extensionPrincipal) return extensionPrincipal.userId;
  if (authHeader?.startsWith("Bearer recall_ext_")) return null;

  // Try a personal bearer token (API / mobile).
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

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { apiTokens, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isApiTokenEmailAllowed } from "@/lib/api-token-access";
import { getApiPrincipal, hasTrustedSessionMutationOrigin } from "@/lib/api-auth";

// The stored account email decides access, never a client-supplied value.
async function canUseApiTokens(userId: string): Promise<boolean> {
  const [user] = await db.select({ email: users.email }).from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return isApiTokenEmailAllowed(user?.email);
}

// GET: return existing token or null
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!await canUseApiTokens(session.user.id)) {
    return NextResponse.json({ error: "Feature not available" }, { status: 403 });
  }

  const [existing] = await db.select({ token: apiTokens.token })
    .from(apiTokens)
    .where(eq(apiTokens.userId, session.user.id))
    .limit(1);

  return NextResponse.json({ token: existing?.token ?? null });
}

// POST: generate a new token (replaces existing)
export async function POST(request: NextRequest) {
  const principal = await getApiPrincipal();
  if (principal?.authType !== "session") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasTrustedSessionMutationOrigin(request)) {
    return NextResponse.json({ error: "Untrusted request origin" }, { status: 403 });
  }
  const userId = principal.userId;

  if (!await canUseApiTokens(userId)) {
    return NextResponse.json({ error: "Feature not available" }, { status: 403 });
  }

  // Delete existing tokens for this user
  await db.delete(apiTokens).where(eq(apiTokens.userId, userId));

  // Generate new token
  const token = `recall_${crypto.randomUUID().replace(/-/g, "")}`;

  await db.insert(apiTokens).values({
    userId,
    token,
  });

  return NextResponse.json({ token });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { apiTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hasFeatureFlag, FLAGS } from "@/lib/feature-flags";
import { getApiPrincipal, hasTrustedSessionMutationOrigin } from "@/lib/api-auth";

// GET: return existing token or null
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!await hasFeatureFlag(session.user.id, FLAGS.API_TOKENS)) {
    return NextResponse.json({ error: "Feature not available" }, { status: 403 });
  }

  const [existing] = await (db as any).select()
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

  if (!await hasFeatureFlag(userId, FLAGS.API_TOKENS)) {
    return NextResponse.json({ error: "Feature not available" }, { status: 403 });
  }

  // Delete existing tokens for this user
  await (db as any).delete(apiTokens).where(eq(apiTokens.userId, userId));

  // Generate new token
  const token = `recall_${crypto.randomUUID().replace(/-/g, "")}`;

  await (db as any).insert(apiTokens).values({
    userId,
    token,
  });

  return NextResponse.json({ token });
}

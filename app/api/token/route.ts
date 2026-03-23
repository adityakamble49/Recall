import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { apiTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET: return existing token or null
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [existing] = await (db as any).select()
    .from(apiTokens)
    .where(eq(apiTokens.userId, session.user.id))
    .limit(1);

  return NextResponse.json({ token: existing?.token ?? null });
}

// POST: generate a new token (replaces existing)
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Delete existing tokens for this user
  await (db as any).delete(apiTokens).where(eq(apiTokens.userId, session.user.id));

  // Generate new token
  const token = `recall_${crypto.randomUUID().replace(/-/g, "")}`;

  await (db as any).insert(apiTokens).values({
    userId: session.user.id,
    token,
  });

  return NextResponse.json({ token });
}

import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { bookmarks, collections } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

async function getOrCreateDefaultCollection(userId: string): Promise<number> {
  const [existing] = await (db as any).select({ id: collections.id }).from(collections)
    .where(and(eq(collections.userId, userId), eq(collections.isDefault, true)))
    .limit(1);
  if (existing) return existing.id;
  const [created] = await (db as any).insert(collections)
    .values({ userId, name: "Recall Later", isDefault: true })
    .returning({ id: collections.id });
  return created.id;
}

export async function POST(req: NextRequest) {
  const userId = await getApiUser();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, url, collectionId } = body;
  if (!title || !url) return NextResponse.json({ error: "title and url required" }, { status: 400 });

  const targetId = collectionId ?? await getOrCreateDefaultCollection(userId);

  // Duplicate check
  const [existing] = await (db as any).select({ id: bookmarks.id }).from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), eq(bookmarks.collectionId, targetId), eq(bookmarks.url, url)))
    .limit(1);
  if (existing) return NextResponse.json({ error: "Already saved in this collection" }, { status: 409 });

  let favicon: string | undefined;
  try { favicon = `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`; } catch {}

  await (db as any).insert(bookmarks).values({ userId, title, url, collectionId: targetId, favicon });

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const userId = await getApiUser();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const collectionId = req.nextUrl.searchParams.get("collectionId");

  const where = collectionId
    ? and(eq(bookmarks.userId, userId), eq(bookmarks.collectionId, parseInt(collectionId)))
    : eq(bookmarks.userId, userId);

  const results = await (db as any).select().from(bookmarks)
    .where(where)
    .orderBy(desc(bookmarks.createdAt));

  return NextResponse.json(results);
}

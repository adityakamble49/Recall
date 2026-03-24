import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { collections, bookmarks } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";

export async function GET() {
  const userId = await getApiUser();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cols = await (db as any).select().from(collections)
    .where(eq(collections.userId, userId));

  const counts = await (db as any).select({
    collectionId: bookmarks.collectionId,
    count: count(),
  }).from(bookmarks)
    .where(eq(bookmarks.userId, userId))
    .groupBy(bookmarks.collectionId);

  const countMap = new Map(counts.map((c: any) => [c.collectionId, Number(c.count)]));

  return NextResponse.json(
    cols.map((col: any) => ({ ...col, bookmarkCount: countMap.get(col.id) ?? 0 }))
  );
}

export async function POST(req: NextRequest) {
  const userId = await getApiUser();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description, icon, color } = await req.json();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const [created] = await (db as any).insert(collections)
    .values({ userId, name, description, icon, color })
    .returning({ id: collections.id });

  return NextResponse.json({ id: created.id });
}

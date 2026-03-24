"use server";

import { db } from "@/lib/db";
import { collections, bookmarks } from "@/lib/db/schema";
import { revalidatePath } from "next/cache";
import { desc, eq, and, count } from "drizzle-orm";
import { auth } from "@/auth";

async function getSession() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session;
}

// --- Collections ---

export async function getCollections() {
  const session = await getSession();
  return (db as any).select().from(collections)
    .where(and(eq(collections.userId, session.user!.id!), eq(collections.isDeleted, false)))
    .orderBy(desc(collections.isPinned), collections.name);
}

export async function getCollectionsWithCount() {
  const session = await getSession();
  const cols = await getCollections();
  const counts = await (db as any).select({
    collectionId: bookmarks.collectionId,
    count: count(),
  }).from(bookmarks)
    .where(eq(bookmarks.userId, session.user!.id!))
    .groupBy(bookmarks.collectionId);

  const countMap = new Map(counts.map((c: any) => [c.collectionId, Number(c.count)]));
  return cols.map((col: any) => ({ ...col, bookmarkCount: countMap.get(col.id) ?? 0 }));
}

export async function createCollection(data: { name: string; description?: string; icon?: string; color?: string }) {
  const session = await getSession();
  await (db as any).insert(collections).values({ userId: session.user!.id!, ...data });
  revalidatePath("/", "layout");
}

export async function deleteCollection(id: number) {
  const session = await getSession();
  await (db as any).update(collections)
    .set({ isDeleted: true, deletedAt: new Date() })
    .where(and(eq(collections.id, id), eq(collections.userId, session.user!.id!)));
}

export async function getDeletedCollections() {
  const session = await getSession();
  return (db as any).select().from(collections)
    .where(and(eq(collections.userId, session.user!.id!), eq(collections.isDeleted, true)))
    .orderBy(desc(collections.deletedAt));
}

export async function restoreCollection(id: number) {
  const session = await getSession();
  await (db as any).update(collections)
    .set({ isDeleted: false, deletedAt: null })
    .where(and(eq(collections.id, id), eq(collections.userId, session.user!.id!)));
}

export async function permanentlyDeleteCollection(id: number) {
  const session = await getSession();
  await (db as any).delete(collections)
    .where(and(eq(collections.id, id), eq(collections.userId, session.user!.id!)));
}

// --- Bookmarks ---

export async function getAllBookmarks() {
  const session = await getSession();
  return (db as any).select().from(bookmarks)
    .where(eq(bookmarks.userId, session.user!.id!))
    .orderBy(desc(bookmarks.createdAt));
}

export async function getRecentBookmarks(limit = 8) {
  const session = await getSession();
  return (db as any).select().from(bookmarks)
    .where(eq(bookmarks.userId, session.user!.id!))
    .orderBy(desc(bookmarks.createdAt))
    .limit(limit);
}

export async function getBookmarksByCollection(collectionId: number) {
  const session = await getSession();
  return (db as any).select().from(bookmarks)
    .where(and(eq(bookmarks.userId, session.user!.id!), eq(bookmarks.collectionId, collectionId)))
    .orderBy(desc(bookmarks.createdAt));
}

export async function getCollectionById(id: number) {
  const session = await getSession();
  const [col] = await (db as any).select().from(collections)
    .where(and(eq(collections.id, id), eq(collections.userId, session.user!.id!)));
  return col ?? null;
}

export async function createBookmark(data: { title: string; url: string; description?: string; collectionId?: number }): Promise<{ error?: string }> {
  const session = await getSession();

  // Duplicate check within same collection
  const where = data.collectionId
    ? and(eq(bookmarks.userId, session.user!.id!), eq(bookmarks.collectionId, data.collectionId), eq(bookmarks.url, data.url))
    : and(eq(bookmarks.userId, session.user!.id!), eq(bookmarks.url, data.url));
  const [existing] = await (db as any).select({ id: bookmarks.id }).from(bookmarks).where(where).limit(1);
  if (existing) return { error: "Already saved in this collection" };

  let favicon: string | undefined;
  try {
    const u = new URL(data.url);
    favicon = `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;
  } catch { /* ignore */ }

  await (db as any).insert(bookmarks).values({
    userId: session.user!.id!,
    title: data.title,
    url: data.url,
    description: data.description,
    collectionId: data.collectionId,
    favicon,
  });
  revalidatePath("/", "layout");
  return {};
}

export async function deleteBookmark(id: number) {
  const session = await getSession();
  await (db as any).delete(bookmarks).where(and(eq(bookmarks.id, id), eq(bookmarks.userId, session.user!.id!)));
  revalidatePath("/", "layout");
}

export async function toggleFavorite(id: number, current: boolean) {
  const session = await getSession();
  await (db as any).update(bookmarks)
    .set({ isFavorite: !current })
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, session.user!.id!)));
  revalidatePath("/", "layout");
}

export async function getTotalBookmarkCount() {
  const session = await getSession();
  const [result] = await (db as any).select({ count: count() }).from(bookmarks)
    .where(eq(bookmarks.userId, session.user!.id!));
  return Number(result?.count ?? 0);
}

export async function getBookmarkChecksum() {
  const session = await getSession();
  const userId = session.user!.id!;
  const [countResult] = await (db as any).select({ count: count() }).from(bookmarks)
    .where(eq(bookmarks.userId, userId));
  const [latest] = await (db as any).select({ id: bookmarks.id }).from(bookmarks)
    .where(eq(bookmarks.userId, userId))
    .orderBy(desc(bookmarks.id))
    .limit(1);
  return { count: Number(countResult?.count ?? 0), latestId: Number(latest?.id ?? 0) };
}

export async function moveBookmark(bookmarkId: number, targetCollectionId: number | null) {
  const session = await getSession();
  await (db as any).update(bookmarks)
    .set({ collectionId: targetCollectionId })
    .where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, session.user!.id!)));
  revalidatePath("/", "layout");
}

export async function updateCollection(id: number, data: { name?: string; description?: string }) {
  const session = await getSession();
  await (db as any).update(collections)
    .set(data)
    .where(and(eq(collections.id, id), eq(collections.userId, session.user!.id!)));
  revalidatePath("/", "layout");
}

export async function mergeCollections(sourceIds: number[], targetId: number) {
  const session = await getSession();
  const userId = session.user!.id!;
  // Move all bookmarks from sources to target
  for (const srcId of sourceIds) {
    await (db as any).update(bookmarks)
      .set({ collectionId: targetId })
      .where(and(eq(bookmarks.collectionId, srcId), eq(bookmarks.userId, userId)));
  }
  // Delete source collections
  for (const srcId of sourceIds) {
    await (db as any).delete(collections)
      .where(and(eq(collections.id, srcId), eq(collections.userId, userId)));
  }
  revalidatePath("/", "layout");
}

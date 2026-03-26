"use server";

import { db } from "@/lib/db";
import { collections, bookmarks } from "@/lib/db/schema";
import { desc, eq, and, count, notInArray, isNull, or, inArray } from "drizzle-orm";
import { auth } from "@/auth";

async function getSession() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session;
}

// --- Collections ---

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

export async function getCollections() {
  const session = await getSession();
  return (db as any).select().from(collections)
    .where(and(eq(collections.userId, session.user!.id!), eq(collections.isDeleted, false)))
    .orderBy(desc(collections.isDefault), desc(collections.isPinned), collections.name);
}

export async function getCollectionsWithCount() {
  const session = await getSession();
  await getOrCreateDefaultCollection(session.user!.id!);
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

export async function createCollection(data: { name: string; description?: string; icon?: string; color?: string }): Promise<{ error?: string }> {
  const session = await getSession();
  const userId = session.user!.id!;
  const [existing] = await (db as any).select({ id: collections.id }).from(collections)
    .where(and(eq(collections.userId, userId), eq(collections.name, data.name), eq(collections.isDeleted, false)))
    .limit(1);
  if (existing) return { error: "Collection already exists" };
  await (db as any).insert(collections).values({ userId, ...data });
  return {};
}

export async function deleteCollection(id: number) {
  const session = await getSession();
  const [col] = await (db as any).select({ isDefault: collections.isDefault }).from(collections)
    .where(and(eq(collections.id, id), eq(collections.userId, session.user!.id!)));
  if (col?.isDefault) throw new Error("Cannot delete default collection");
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
  const userId = session.user!.id!;
  await (db as any).delete(bookmarks)
    .where(and(eq(bookmarks.collectionId, id), eq(bookmarks.userId, userId)));
  await (db as any).delete(collections)
    .where(and(eq(collections.id, id), eq(collections.userId, userId)));
}

// --- Bookmarks ---

export async function getAllBookmarks() {
  const session = await getSession();
  const userId = session.user!.id!;
  const trashedIds = (await (db as any).select({ id: collections.id }).from(collections)
    .where(and(eq(collections.userId, userId), eq(collections.isDeleted, true))))
    .map((c: any) => c.id);
  const where = trashedIds.length > 0
    ? and(eq(bookmarks.userId, userId), or(isNull(bookmarks.collectionId), notInArray(bookmarks.collectionId, trashedIds)))
    : eq(bookmarks.userId, userId);
  return (db as any).select().from(bookmarks).where(where).orderBy(desc(bookmarks.createdAt));
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
  const userId = session.user!.id!;
  const collectionId = data.collectionId ?? await getOrCreateDefaultCollection(userId);

  // Duplicate check within same collection
  const [existing] = await (db as any).select({ id: bookmarks.id }).from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), eq(bookmarks.collectionId, collectionId), eq(bookmarks.url, data.url)))
    .limit(1);
  if (existing) return { error: "Already saved in this collection" };

  let favicon: string | undefined;
  try { favicon = `https://www.google.com/s2/favicons?domain=${new URL(data.url).hostname}&sz=64`; } catch {}

  await (db as any).insert(bookmarks).values({
    userId,
    title: data.title,
    url: data.url,
    description: data.description,
    collectionId,
    favicon,
  });
  return {};
}

export async function deleteBookmark(id: number) {
  const session = await getSession();
  await (db as any).delete(bookmarks).where(and(eq(bookmarks.id, id), eq(bookmarks.userId, session.user!.id!)));
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
}

export async function renameBookmark(id: number, title: string) {
  const session = await getSession();
  await (db as any).update(bookmarks)
    .set({ title })
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, session.user!.id!)));
}

export async function updateCollection(id: number, data: { name?: string; description?: string }) {
  const session = await getSession();
  await (db as any).update(collections)
    .set(data)
    .where(and(eq(collections.id, id), eq(collections.userId, session.user!.id!)));
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
}


export async function bulkMoveBookmarks(ids: number[], collectionId: number) {
  const session = await getSession();
  await (db as any).update(bookmarks)
    .set({ collectionId })
    .where(and(eq(bookmarks.userId, session.user!.id!), inArray(bookmarks.id, ids)));
}

export async function bulkDeleteBookmarks(ids: number[]) {
  const session = await getSession();
  await (db as any).delete(bookmarks)
    .where(and(eq(bookmarks.userId, session.user!.id!), inArray(bookmarks.id, ids)));
}

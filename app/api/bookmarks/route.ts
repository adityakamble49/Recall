import { NextRequest, NextResponse } from "next/server";
import { getApiPrincipal, getApiUser, hasTrustedSessionMutationOrigin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { bookmarks, collections } from "@/lib/db/schema";
import { eq, and, desc, or, isNull, notInArray } from "drizzle-orm";
import { validateBookmarkFields } from "@/lib/validation";
import { fetchPageTitle } from "@/lib/fetch-title";
import { getOwnedActiveCollectionId, isValidCollectionId } from "@/lib/collection-access";

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
  const principal = await getApiPrincipal("bookmarks:write");
  if (!principal) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (principal.authType === "session" && !hasTrustedSessionMutationOrigin(req)) {
    return NextResponse.json({ error: "Untrusted request origin" }, { status: 403 });
  }
  const userId = principal.userId;

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (typeof parsed !== "object" || parsed === null) throw new Error("not an object");
    body = parsed;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { title, url, collectionId } = body;
  const description = body.description ?? undefined;
  if (!title || !url) return NextResponse.json({ error: "title and url required" }, { status: 400 });

  const fieldCheck = validateBookmarkFields({ title, url, description });
  if (!fieldCheck.valid) return NextResponse.json({ error: fieldCheck.error }, { status: 400 });
  // validateBookmarkFields confirmed these are strings.
  const titleText = title as string;
  const urlText = url as string;
  const descriptionText = description as string | undefined;

  let targetId: number;
  if (collectionId === undefined || collectionId === null) {
    targetId = await getOrCreateDefaultCollection(userId);
  } else {
    if (!isValidCollectionId(collectionId)) {
      return NextResponse.json({ error: "collectionId must be a positive integer" }, { status: 400 });
    }
    const ownedCollectionId = await getOwnedActiveCollectionId(userId, collectionId);
    if (ownedCollectionId === null) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }
    targetId = ownedCollectionId;
  }

  // Duplicate check
  const [existing] = await (db as any).select({ id: bookmarks.id }).from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), eq(bookmarks.collectionId, targetId), eq(bookmarks.url, urlText)))
    .limit(1);
  if (existing) return NextResponse.json({ error: "Already saved in this collection" }, { status: 409 });

  // iOS Shortcut can only forward the URL, so it sends title === url. In that case
  // fetch the real page title; best-effort, falls back to the URL on failure.
  let finalTitle = titleText;
  if (titleText === urlText) {
    const fetched = await fetchPageTitle(urlText);
    if (fetched) finalTitle = fetched;
  }

  let favicon: string | undefined;
  try { favicon = `https://www.google.com/s2/favicons?domain=${new URL(urlText).hostname}&sz=64`; } catch {}

  await (db as any).insert(bookmarks).values({
    userId,
    title: finalTitle,
    url: urlText,
    description: descriptionText,
    collectionId: targetId,
    favicon,
  });

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const userId = await getApiUser("bookmarks:read");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const collectionParam = req.nextUrl.searchParams.get("collectionId");

  if (collectionParam !== null) {
    const parsed = /^[1-9]\d*$/.test(collectionParam) ? Number(collectionParam) : NaN;
    if (!isValidCollectionId(parsed)) {
      return NextResponse.json({ error: "collectionId must be a positive integer" }, { status: 400 });
    }
    // Same non-enumerating 404 for foreign, missing and trashed collections.
    const ownedCollectionId = await getOwnedActiveCollectionId(userId, parsed);
    if (ownedCollectionId === null) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }
    const results = await db.select().from(bookmarks)
      .where(and(eq(bookmarks.userId, userId), eq(bookmarks.collectionId, ownedCollectionId)))
      .orderBy(desc(bookmarks.createdAt));
    return NextResponse.json(results);
  }

  // All bookmarks except those in trashed collections, matching the dashboard.
  const trashedIds = (await db.select({ id: collections.id }).from(collections)
    .where(and(eq(collections.userId, userId), eq(collections.isDeleted, true))))
    .map((collection) => collection.id);
  const where = trashedIds.length > 0
    ? and(eq(bookmarks.userId, userId), or(isNull(bookmarks.collectionId), notInArray(bookmarks.collectionId, trashedIds)))
    : eq(bookmarks.userId, userId);

  const results = await db.select().from(bookmarks)
    .where(where)
    .orderBy(desc(bookmarks.createdAt));

  return NextResponse.json(results);
}

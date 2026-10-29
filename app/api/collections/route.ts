import { NextRequest, NextResponse } from "next/server";
import { getApiPrincipal, getApiUser, hasTrustedSessionMutationOrigin } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { collections, bookmarks } from "@/lib/db/schema";
import { eq, count, and, desc } from "drizzle-orm";
import { validateCollectionFields } from "@/lib/validation";

export async function GET() {
  const userId = await getApiUser("collections:read");
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cols = await (db as any).select().from(collections)
    .where(and(eq(collections.userId, userId), eq(collections.isDeleted, false)))
    .orderBy(desc(collections.isDefault), desc(collections.isPinned), collections.name);

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
  const principal = await getApiPrincipal("collections:write");
  if (!principal) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (principal.authType === "session" && !hasTrustedSessionMutationOrigin(req)) {
    return NextResponse.json({ error: "Untrusted request origin" }, { status: 403 });
  }
  const userId = principal.userId;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const check = validateCollectionFields(body, { requireName: true });
  if (!check.valid) return NextResponse.json({ error: check.error }, { status: 400 });
  const fields = check.value;

  // Duplicate name check
  const [existing] = await (db as any).select({ id: collections.id }).from(collections)
    .where(and(eq(collections.userId, userId), eq(collections.name, fields.name), eq(collections.isDeleted, false)))
    .limit(1);
  if (existing) return NextResponse.json({ error: "Collection already exists" }, { status: 409 });

  const [created] = await (db as any).insert(collections)
    .values({ ...fields, userId })
    .returning({ id: collections.id });

  return NextResponse.json({ id: created.id });
}

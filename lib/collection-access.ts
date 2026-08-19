import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { collections } from "@/lib/db/schema";

export function isValidCollectionId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export async function getOwnedActiveCollectionId(userId: string, collectionId: unknown): Promise<number | null> {
  if (!isValidCollectionId(collectionId)) return null;

  const [collection] = await db.select({ id: collections.id }).from(collections)
    .where(and(
      eq(collections.id, collectionId),
      eq(collections.userId, userId),
      eq(collections.isDeleted, false),
    ))
    .limit(1);

  return collection?.id ?? null;
}

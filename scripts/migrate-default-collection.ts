import { db } from "@/lib/db";
import { collections, bookmarks, users } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

async function migrate() {
  const allUsers = await (db as any).select({ id: users.id }).from(users);
  console.log(`Migrating ${allUsers.length} users...`);

  for (const user of allUsers) {
    // Get or create default collection
    const [existing] = await (db as any).select({ id: collections.id }).from(collections)
      .where(and(eq(collections.userId, user.id), eq(collections.isDefault, true)))
      .limit(1);

    let defaultId: number;
    if (existing) {
      defaultId = existing.id;
      console.log(`  User ${user.id}: default collection exists (${defaultId})`);
    } else {
      const [created] = await (db as any).insert(collections)
        .values({ userId: user.id, name: "Recall Later", isDefault: true })
        .returning({ id: collections.id });
      defaultId = created.id;
      console.log(`  User ${user.id}: created default collection (${defaultId})`);
    }

    // Move null bookmarks to default
    const result = await (db as any).update(bookmarks)
      .set({ collectionId: defaultId })
      .where(and(eq(bookmarks.userId, user.id), isNull(bookmarks.collectionId)));
    console.log(`  User ${user.id}: migrated null bookmarks`);
  }

  console.log("Done!");
  process.exit(0);
}

migrate().catch(console.error);

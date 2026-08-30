import {
  pgTable, text, integer, timestamp, serial, primaryKey, boolean, unique, index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { AdapterAccountType } from "next-auth/adapters";

// --- Auth.js Tables ---

export const users = pgTable("user", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable("account", {
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").$type<AdapterAccountType>().notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("providerAccountId").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (account) => ({
  compoundKey: primaryKey({ columns: [account.provider, account.providerAccountId] }),
}));

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable("verificationToken", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
}, (vt) => ({
  compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
}));

// --- App Tables ---

export const collections = pgTable("collections", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon").default("folder"),
  color: text("color").default("#4343d5"),
  isPinned: boolean("is_pinned").default(false).notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  isDeleted: boolean("is_deleted").default(false).notNull(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const bookmarks = pgTable("bookmarks", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  collectionId: integer("collection_id").references(() => collections.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  url: text("url").notNull(),
  description: text("description"),
  favicon: text("favicon"),
  isFavorite: boolean("is_favorite").default(false).notNull(),
  isArchived: boolean("is_archived").default(false).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const apiTokens = pgTable("api_tokens", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  name: text("name").default("Chrome Extension").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const extensionAuthCodes = pgTable("extension_auth_codes", {
  codeHash: text("code_hash").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  codeChallenge: text("code_challenge").notNull(),
  redirectUri: text("redirect_uri").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  usedAt: timestamp("used_at", { mode: "date" }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("extension_auth_codes_expires_at_idx").on(table.expiresAt),
]);

export const extensionCredentials = pgTable("extension_credentials", {
  id: serial("id").primaryKey(),
  publicId: text("public_id").notNull().unique(),
  secretHash: text("secret_hash").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").default("Chrome Extension").notNull(),
  scopes: text("scopes").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  revokedAt: timestamp("revoked_at", { mode: "date" }),
  lastUsedAt: timestamp("last_used_at", { mode: "date" }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("extension_credentials_user_id_idx").on(table.userId),
  index("extension_credentials_expires_at_idx").on(table.expiresAt),
]);

export const featureFlags = pgTable("feature_flags", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  flag: text("flag").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  unique().on(table.userId, table.flag),
]);

export type Collection = typeof collections.$inferSelect;
export type NewCollection = typeof collections.$inferInsert;
export type Bookmark = typeof bookmarks.$inferSelect;
export type NewBookmark = typeof bookmarks.$inferInsert;

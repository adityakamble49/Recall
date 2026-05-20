import { db } from "@/lib/db";
import { featureFlags } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export const FLAGS = {
  API_TOKENS: "api_tokens",
} as const;

export async function hasFeatureFlag(userId: string, flag: string): Promise<boolean> {
  const [row] = await (db as any).select({ enabled: featureFlags.enabled })
    .from(featureFlags)
    .where(and(eq(featureFlags.userId, userId), eq(featureFlags.flag, flag)))
    .limit(1);
  return row?.enabled === true;
}

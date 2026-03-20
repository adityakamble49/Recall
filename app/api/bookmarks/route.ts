import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { bookmarks } from "@/lib/db/schema";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, url, collectionId } = body;
  if (!title || !url) return NextResponse.json({ error: "title and url required" }, { status: 400 });

  let favicon: string | undefined;
  try { favicon = `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`; } catch {}

  await (db as any).insert(bookmarks).values({
    userId: session.user.id,
    title,
    url,
    collectionId: collectionId ?? null,
    favicon,
  });

  return NextResponse.json({ ok: true });
}

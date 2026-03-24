import { auth } from "@/auth";
import { getRecentBookmarks, getCollectionsWithCount, getTotalBookmarkCount } from "./actions";
import { BookmarkCard } from "@/components/BookmarkCard";
import { CollectionCard } from "@/components/CollectionCard";
import { InstantCapture } from "@/components/InstantCapture";
import { SignInPrompt } from "@/components/SignInPrompt";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();

  if (!session?.user) return <SignInPrompt />;

  const [recentBookmarks, collections, totalCount] = await Promise.all([
    getRecentBookmarks(),
    getCollectionsWithCount(),
    getTotalBookmarkCount(),
  ]);

  const pinnedCollection = collections.find((c: any) => c.isPinned);

  return (
    <div className="p-6 md:p-8 lg:p-12">
      {/* Hero */}
      <section className="mb-10 md:mb-16 grid grid-cols-1 lg:grid-cols-3 gap-8 items-end">
        <div className="lg:col-span-2">
          {/* Mobile hero */}
          <p className="md:hidden text-[10px] font-bold tracking-widest uppercase text-outline mb-1">
            Dashboard Overview
          </p>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tighter text-on-surface mb-2 md:mb-4">
            <span className="hidden md:inline">Precision<br />Organization.</span>
            <span className="md:hidden">Your Sanctuary</span>
          </h1>
          {/* Mobile: big count */}
          <div className="flex items-baseline gap-2 md:hidden mb-4">
            <span className="text-5xl font-black text-primary tracking-tighter">{totalCount.toLocaleString()}</span>
            <span className="text-sm font-medium text-on-surface-variant/70 uppercase tracking-wider">bookmarks</span>
          </div>
          <p className="hidden md:block text-on-surface-variant text-lg max-w-md">
            Capture every insight with surgical precision. Your digital library, evolved into a high-performance utility.
          </p>
        </div>
        <div className="hidden lg:flex justify-end">
          <Link
            href="/add"
            className="group flex items-center gap-4 bg-gradient-to-br from-primary to-primary-container text-on-primary-container px-8 py-5 rounded-xl transition-all hover:scale-[1.02] active:scale-95"
          >
            <div className="flex flex-col items-start">
              <span className="text-[0.6875rem] font-bold uppercase tracking-widest opacity-80">Instant Action</span>
              <span className="text-xl font-bold">Add Bookmark</span>
            </div>
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center group-hover:bg-white/30 transition-colors">
              <span className="material-symbols-outlined text-2xl">add</span>
            </div>
          </Link>
        </div>
      </section>

      {/* Mobile: Instant Capture */}
      <section className="md:hidden mb-10">
        <InstantCapture />
      </section>

      {/* Curated Collections */}
      {collections.length > 0 && (
        <section className="mb-10 md:mb-16">
          <div className="flex justify-between items-end mb-6 md:mb-8">
            <div>
              <span className="hidden md:block text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-primary mb-2">
                Editor&apos;s Picks
              </span>
              <h2 className="text-lg md:text-3xl font-extrabold tracking-tight">
                <span className="md:hidden">Recently Added</span>
                <span className="hidden md:inline">Curated Collections</span>
              </h2>
              <div className="h-0.5 w-8 bg-primary mt-1 md:hidden" />
            </div>
            <Link href="/collections" className="text-[10px] md:text-sm font-bold text-primary uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all">
              View All <span className="material-symbols-outlined text-sm hidden md:inline">arrow_forward</span>
            </Link>
          </div>

          {/* Desktop: bento grid */}
          <div className="hidden md:grid grid-cols-4 grid-rows-2 gap-4 h-[500px]">
            {collections.slice(0, 4).map((col: any, i: number) => (
              <CollectionCard key={col.id} collection={col} variant={i === 0 ? "featured" : i === 1 ? "medium" : "small"} />
            ))}
          </div>

          {/* Mobile: bento */}
          <div className="md:hidden grid grid-cols-2 gap-3 mt-6">
            {pinnedCollection && (
              <Link href={`/collections/${pinnedCollection.id}`} className="bg-primary p-4 rounded-xl flex flex-col justify-between aspect-square">
                <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>folder_special</span>
                <div className="text-white">
                  <p className="text-[10px] font-bold tracking-widest uppercase opacity-80">Pinned</p>
                  <p className="text-lg font-bold">{pinnedCollection.name}</p>
                </div>
              </Link>
            )}
            <div className="flex flex-col gap-3">
              <div className="bg-surface-container h-1/2 rounded-xl p-3 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-xs font-bold text-on-surface">Collections</p>
                  <p className="text-[10px] text-outline">{collections.length} total</p>
                </div>
              </div>
              <div className="bg-surface-container h-1/2 rounded-xl p-3 flex items-center justify-center border border-outline-variant/10">
                <span className="material-symbols-outlined text-primary">auto_awesome</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Recently Added Bookmarks */}
      <section>
        <div className="flex justify-between items-end mb-6 md:mb-8">
          <div>
            <span className="hidden md:block text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-primary mb-2">Chronological</span>
            <h2 className="hidden md:block text-3xl font-extrabold tracking-tight">Recently Added</h2>
          </div>
        </div>

        {recentBookmarks.length === 0 ? (
          <div className="text-center py-16 text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl mb-4 block">bookmark_add</span>
            <p className="font-bold">No bookmarks yet</p>
            <p className="text-sm mt-1">Add your first bookmark to get started.</p>
          </div>
        ) : (
          <>
            {/* Mobile: list */}
            <div className="md:hidden space-y-4">
              {recentBookmarks.map((bm: any) => (
                <BookmarkCard key={bm.id} bookmark={bm} variant="list" collections={collections} />
              ))}
            </div>
            {/* Desktop: grid */}
            <div className="hidden md:grid grid-cols-2 xl:grid-cols-4 gap-6">
              {recentBookmarks.map((bm: any) => (
                <BookmarkCard key={bm.id} bookmark={bm} variant="card" collections={collections} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

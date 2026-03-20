import { getCollectionById, getBookmarksByCollection } from "@/app/actions";
import { BookmarkCard } from "@/components/BookmarkCard";
import { OpenTabGroupButton } from "@/components/OpenTabGroupButton";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const collectionId = parseInt(id, 10);
  if (isNaN(collectionId)) notFound();

  const [collection, bookmarksList] = await Promise.all([
    getCollectionById(collectionId),
    getBookmarksByCollection(collectionId),
  ]);

  if (!collection) notFound();

  const urls = bookmarksList.map((b: any) => b.url);

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <section className="mb-8 md:mb-10">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/collections" className="text-[0.6875rem] font-bold tracking-widest uppercase text-primary py-1 px-2 bg-primary-container/10 rounded-sm">
            Collections
          </Link>
          <span className="text-[0.6875rem] font-bold tracking-widest uppercase text-on-surface-variant">
            / {collection.name}
          </span>
        </div>
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
          <div>
            <h1 className="text-4xl md:text-[3.5rem] font-extrabold tracking-tighter text-on-surface leading-none">
              {collection.name}
            </h1>
            {collection.description && (
              <p className="text-on-surface-variant text-sm mt-2 md:mt-4 max-w-lg">{collection.description}</p>
            )}
          </div>
          <div className="flex gap-3">
            <OpenTabGroupButton urls={urls} name={collection.name} />
          </div>
        </div>
      </section>

      {/* Bookmark count */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-[0.6875rem] font-bold tracking-widest uppercase text-outline">
          {bookmarksList.length} Bookmarks
        </h2>
      </div>

      {/* Bookmarks */}
      {bookmarksList.length === 0 ? (
        <div className="text-center py-16 text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl mb-4 block">bookmark_add</span>
          <p className="font-bold">No bookmarks in this collection</p>
        </div>
      ) : (
        <>
          {/* Mobile: list */}
          <div className="md:hidden space-y-4">
            {bookmarksList.map((bm: any) => (
              <BookmarkCard key={bm.id} bookmark={bm} variant="list" />
            ))}
          </div>
          {/* Desktop: grid */}
          <div className="hidden md:grid grid-cols-2 xl:grid-cols-3 gap-6">
            {bookmarksList.map((bm: any) => (
              <BookmarkCard key={bm.id} bookmark={bm} variant="card" />
            ))}
          </div>
        </>
      )}

      {/* Mobile FAB */}
      <Link
        href={`/add?collection=${collectionId}`}
        className="md:hidden fixed bottom-24 right-6 z-40 w-14 h-14 bg-primary text-on-primary rounded-xl shadow-lg flex items-center justify-center active:scale-90 transition-all"
      >
        <span className="material-symbols-outlined">add</span>
      </Link>
    </div>
  );
}

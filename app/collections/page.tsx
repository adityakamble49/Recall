import { auth } from "@/auth";
import { getCollectionsWithCount } from "@/app/actions";
import { SignInPrompt } from "@/components/SignInPrompt";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const session = await auth();
  if (!session?.user) return <SignInPrompt />;

  const collections = await getCollectionsWithCount();

  return (
    <div className="p-6 md:p-8 lg:p-12">
      <div className="flex justify-between items-end mb-8">
        <div>
          <span className="text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-primary mb-2 block">Library</span>
          <h1 className="text-3xl md:text-[3.5rem] font-extrabold tracking-tighter">All Collections</h1>
        </div>
        <Link
          href="/add?mode=collection"
          className="px-4 py-2 bg-primary text-on-primary text-sm font-bold rounded-md active:scale-95 transition-all"
        >
          + New
        </Link>
      </div>

      {collections.length === 0 ? (
        <div className="text-center py-16 text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl mb-4 block">create_new_folder</span>
          <p className="font-bold">No collections yet</p>
          <p className="text-sm mt-1">Create your first collection to organize bookmarks.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map((col: any) => (
            <Link
              key={col.id}
              href={`/collections/${col.id}`}
              className="bg-surface-container-low p-6 rounded-xl border border-outline-variant/10 hover:border-primary/40 hover:bg-surface-container transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-surface-container-highest flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {col.icon ?? "folder"}
                  </span>
                </div>
                {col.isPinned && (
                  <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>push_pin</span>
                )}
              </div>
              <h3 className="font-bold text-lg mb-1">{col.name}</h3>
              {col.description && <p className="text-on-surface-variant text-sm line-clamp-2 mb-3">{col.description}</p>}
              <p className="text-[0.6875rem] font-bold text-on-surface-variant/60 uppercase tracking-wider">
                {col.bookmarkCount} bookmarks
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

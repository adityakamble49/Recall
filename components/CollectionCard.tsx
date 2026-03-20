import Link from "next/link";
import { type Collection } from "@/lib/db/schema";

type Props = {
  collection: Collection & { bookmarkCount: number };
  variant: "featured" | "medium" | "small";
};

export function CollectionCard({ collection, variant }: Props) {
  const href = `/collections/${collection.id}`;

  if (variant === "featured") {
    return (
      <Link href={href} className="col-span-2 row-span-2 relative overflow-hidden rounded-xl bg-surface-container-low group cursor-pointer border border-outline-variant/10">
        <div className="absolute inset-0 bg-gradient-to-t from-on-surface/90 via-on-surface/20 to-transparent p-8 flex flex-col justify-end">
          <div className="bg-primary px-3 py-1 rounded-full w-fit mb-4">
            <span className="text-[0.6rem] font-black text-white uppercase tracking-tighter">
              {collection.isPinned ? "Pinned" : "Essential"}
            </span>
          </div>
          <h3 className="text-3xl font-bold text-white mb-2">{collection.name}</h3>
          <p className="text-white/70 text-sm">{collection.bookmarkCount} bookmarks</p>
        </div>
      </Link>
    );
  }

  if (variant === "medium") {
    return (
      <Link href={href} className="col-span-2 relative overflow-hidden rounded-xl bg-surface-container-high group cursor-pointer border border-outline-variant/10">
        <div className="absolute inset-0 p-6 flex flex-col justify-between">
          <div className="w-12 h-12 bg-white/80 backdrop-blur rounded-lg flex items-center justify-center text-primary">
            <span className="material-symbols-outlined">{collection.icon ?? "folder"}</span>
          </div>
          <div>
            <h3 className="text-xl font-bold">{collection.name}</h3>
            <p className="text-on-surface-variant text-xs font-medium uppercase tracking-wider mt-1">
              {collection.bookmarkCount} items
            </p>
          </div>
        </div>
      </Link>
    );
  }

  // small
  return (
    <Link href={href} className="relative overflow-hidden rounded-xl bg-surface-container-lowest group cursor-pointer border border-outline-variant/20 hover:border-primary/40 transition-colors">
      <div className="p-6 flex flex-col h-full justify-between">
        <span className="material-symbols-outlined text-secondary text-3xl">{collection.icon ?? "folder"}</span>
        <div>
          <h3 className="font-bold">{collection.name}</h3>
          <p className="text-[0.6rem] text-on-surface-variant font-bold uppercase mt-1">
            {collection.bookmarkCount} Bookmarks
          </p>
        </div>
      </div>
    </Link>
  );
}

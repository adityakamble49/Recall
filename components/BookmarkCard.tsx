"use client";

import { type Bookmark } from "@/lib/db/schema";
import { deleteBookmark, toggleFavorite } from "@/app/actions";
import { formatDistanceToNow } from "@/lib/utils";

export function BookmarkCard({ bookmark, variant }: { bookmark: Bookmark; variant: "list" | "card" }) {
  const domain = (() => { try { return new URL(bookmark.url).hostname; } catch { return bookmark.url; } })();
  const timeAgo = formatDistanceToNow(bookmark.createdAt);

  if (variant === "list") {
    return (
      <a
        href={bookmark.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group bg-surface-container-low p-4 rounded-xl flex gap-4 items-center active:bg-surface-container-highest transition-colors"
      >
        <div className="w-12 h-12 rounded-lg bg-surface-container-highest flex items-center justify-center text-primary shrink-0">
          {bookmark.favicon ? (
            <img src={bookmark.favicon} alt="" className="w-6 h-6" />
          ) : (
            <span className="material-symbols-outlined">language</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-on-surface leading-snug truncate">{bookmark.title}</h4>
          <p className="text-[0.6875rem] text-on-surface-variant font-medium tracking-wide truncate">{domain}</p>
        </div>
        <span className="material-symbols-outlined text-outline-variant group-hover:text-primary transition-colors">
          chevron_right
        </span>
      </a>
    );
  }

  // Desktop card variant
  return (
    <div className="bg-surface-container-low rounded-xl p-5 border border-transparent hover:border-outline-variant/20 hover:bg-surface-container transition-all group">
      <div className="flex justify-between items-start mb-4">
        <div className="w-10 h-10 rounded bg-white flex items-center justify-center text-on-surface-variant border border-outline-variant/10">
          {bookmark.favicon ? (
            <img src={bookmark.favicon} alt="" className="w-5 h-5" />
          ) : (
            <span className="material-symbols-outlined text-xl">language</span>
          )}
        </div>
        <button
          onClick={(e) => { e.preventDefault(); toggleFavorite(bookmark.id, bookmark.isFavorite); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <span
            className="material-symbols-outlined text-on-surface-variant text-lg"
            style={bookmark.isFavorite ? { fontVariationSettings: "'FILL' 1" } : undefined}
          >
            star
          </span>
        </button>
      </div>
      <h4 className="font-bold text-base mb-1 line-clamp-1">{bookmark.title}</h4>
      <p className="text-on-surface-variant text-sm mb-4 line-clamp-2 h-10">
        {bookmark.description ?? domain}
      </p>
      <div className="pt-4 border-t border-outline-variant/10 flex justify-between items-center">
        <span className="text-[0.6rem] font-bold text-on-surface-variant/60 uppercase">Added {timeAgo}</span>
        <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
          <span className="material-symbols-outlined text-primary scale-75 group-hover:translate-x-1 transition-transform">
            open_in_new
          </span>
        </a>
      </div>
    </div>
  );
}

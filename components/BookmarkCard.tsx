"use client";

import { useState, useEffect, useRef } from "react";
import { type Bookmark, type Collection } from "@/lib/db/schema";
import { deleteBookmark, toggleFavorite, moveBookmark } from "@/app/actions";
import { formatDistanceToNow } from "@/lib/utils";

type Props = {
  bookmark: Bookmark;
  variant: "list" | "card";
  collections?: Collection[];
};

export function BookmarkCard({ bookmark, variant, collections }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMenu]);
  const [showMove, setShowMove] = useState(false);
  const domain = (() => { try { return new URL(bookmark.url).hostname; } catch { return bookmark.url; } })();
  const timeAgo = formatDistanceToNow(bookmark.createdAt);

  async function handleMove(targetId: number | null) {
    await moveBookmark(bookmark.id, targetId);
    setShowMove(false);
    setShowMenu(false);
  }

  const menuOverlay = showMenu && (
    <div ref={menuRef} className="absolute right-0 top-8 z-20 bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-lg py-1 min-w-[160px]">
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowMove(!showMove); }}
        className="w-full text-left px-4 py-2 text-sm hover:bg-surface-container-high flex items-center gap-2"
      >
        <span className="material-symbols-outlined text-base">drive_file_move</span> Move to...
      </button>
      {showMove && collections && (
        <div className="px-2 py-1 border-t border-outline-variant/10">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleMove(null); }}
            className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-surface-container-high text-on-surface-variant"
          >
            General (no collection)
          </button>
          {collections.filter(c => c.id !== bookmark.collectionId).map(c => (
            <button
              key={c.id}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleMove(c.id); }}
              className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-surface-container-high"
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteBookmark(bookmark.id); setShowMenu(false); }}
        className="w-full text-left px-4 py-2 text-sm text-error hover:bg-error/5 flex items-center gap-2"
      >
        <span className="material-symbols-outlined text-base">delete</span> Delete
      </button>
    </div>
  );

  if (variant === "list") {
    return (
      <div className="relative group bg-surface-container-low p-4 rounded-xl flex gap-4 items-center active:bg-surface-container-highest transition-colors">
        <a href={bookmark.url} target="_blank" rel="noopener noreferrer" className="flex gap-4 items-center flex-1 min-w-0">
          <div className="w-12 h-12 rounded-lg bg-surface-container-highest flex items-center justify-center text-primary shrink-0">
            {bookmark.favicon ? <img src={bookmark.favicon} alt="" className="w-6 h-6" /> : <span className="material-symbols-outlined">language</span>}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-on-surface leading-snug truncate">{bookmark.title}</h4>
            <p className="text-[0.6875rem] text-on-surface-variant font-medium tracking-wide truncate">{domain}</p>
          </div>
        </a>
        <button onClick={() => setShowMenu(!showMenu)} className="text-outline/40 shrink-0">
          <span className="material-symbols-outlined text-lg">more_vert</span>
        </button>
        {menuOverlay}
      </div>
    );
  }

  // Desktop card
  return (
    <div className="relative bg-surface-container-low rounded-xl p-5 border border-transparent hover:border-outline-variant/20 hover:bg-surface-container transition-all group">
      <div className="flex justify-between items-start mb-4">
        <div className="w-10 h-10 rounded bg-white flex items-center justify-center text-on-surface-variant border border-outline-variant/10">
          {bookmark.favicon ? <img src={bookmark.favicon} alt="" className="w-5 h-5" /> : <span className="material-symbols-outlined text-xl">language</span>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleFavorite(bookmark.id, bookmark.isFavorite)}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <span className="material-symbols-outlined text-on-surface-variant text-lg" style={bookmark.isFavorite ? { fontVariationSettings: "'FILL' 1" } : undefined}>star</span>
          </button>
          <button onClick={() => setShowMenu(!showMenu)} className="opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="material-symbols-outlined text-on-surface-variant text-lg">more_vert</span>
          </button>
        </div>
      </div>
      <h4 className="font-bold text-base mb-1 line-clamp-1">{bookmark.title}</h4>
      <p className="text-on-surface-variant text-sm mb-4 line-clamp-2 h-10">{bookmark.description ?? domain}</p>
      <div className="pt-4 border-t border-outline-variant/10 flex justify-between items-center">
        <span className="text-[0.6rem] font-bold text-on-surface-variant/60 uppercase">Added {timeAgo}</span>
        <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
          <span className="material-symbols-outlined text-primary scale-75 group-hover:translate-x-1 transition-transform">open_in_new</span>
        </a>
      </div>
      {menuOverlay}
    </div>
  );
}

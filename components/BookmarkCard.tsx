"use client";

import { useState, useEffect, useRef } from "react";
import { type Bookmark, type Collection } from "@/lib/db/schema";
import { deleteBookmark, moveBookmark, renameBookmark } from "@/app/actions";
import { useDashboard } from "@/lib/dashboard-context";
import { formatDistanceToNow } from "@/lib/utils";
import { MoreVertical, ArrowRight, Trash2, ExternalLink, Pencil } from "lucide-react";

type Props = {
  bookmark: Bookmark;
  variant: "list" | "card";
  collections?: Collection[];
  showCollection?: boolean;
  selected?: boolean;
  onSelect?: (id: number) => void;
  dragIds?: number[];
};

export function BookmarkCard({ bookmark, variant, collections, showCollection, selected, onSelect, dragIds }: Props) {
  const { refresh } = useDashboard();
  const [showMenu, setShowMenu] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const domain = (() => { try { return new URL(bookmark.url).hostname; } catch { return bookmark.url; } })();
  const timeAgo = formatDistanceToNow(bookmark.createdAt);
  const collectionName = showCollection ? collections?.find(c => c.id === bookmark.collectionId)?.name : null;

  useEffect(() => {
    if (!showMenu) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMenu]);

  async function handleMove(targetId: number | null) {
    await moveBookmark(bookmark.id, targetId);
    setShowMove(false);
    setShowMenu(false);
    await refresh();
  }

  async function handleDelete() {
    if (!confirm(`Delete "${bookmark.title}"?`)) return;
    await deleteBookmark(bookmark.id);
    setShowMenu(false);
    await refresh();
  }

  async function handleRename() {
    const newTitle = prompt("Rename bookmark:", bookmark.title);
    if (!newTitle || newTitle.trim() === bookmark.title) return;
    await renameBookmark(bookmark.id, newTitle.trim());
    setShowMenu(false);
    await refresh();
  }

  const menu = showMenu && (
    <div ref={menuRef} className="absolute right-0 top-10 z-20 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm py-1 min-w-[160px]">
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRename(); }}
        className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900 flex items-center gap-2"
      >
        <Pencil className="w-4 h-4" /> Rename
      </button>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowMove(!showMove); }}
        className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900 flex items-center gap-2"
      >
        <ArrowRight className="w-4 h-4" /> Move to...
      </button>
      {showMove && collections && (
        <div className="px-1 py-1 border-t border-zinc-100 dark:border-zinc-800">
          {collections.filter(c => c.id !== bookmark.collectionId).map(c => (
            <button key={c.id} onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleMove(c.id); }} className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-zinc-50 dark:hover:bg-zinc-900">
              {c.name}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(); }}
        className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-2"
      >
        <Trash2 className="w-4 h-4" /> Delete
      </button>
    </div>
  );

  return (
    <div
      draggable
      onDragStart={(e) => {
        const ids = dragIds && dragIds.length > 0 ? dragIds : [bookmark.id];
        e.dataTransfer.setData("text/plain", JSON.stringify(ids));
        e.dataTransfer.effectAllowed = "move";
        setIsDragging(true);
      }}
      onDragEnd={() => setIsDragging(false)}
      className={`relative group flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 cursor-grab active:cursor-grabbing transition-all duration-150 ${selected ? "bg-zinc-50 dark:bg-zinc-900/50" : ""} ${isDragging ? "opacity-50 scale-[0.98]" : ""}`}
      style={{ transitionTimingFunction: "cubic-bezier(0.25, 1, 0.5, 1)" }}>
      {onSelect && (
        <button onClick={() => onSelect(bookmark.id)} className="shrink-0 mr-3">
          <div className={`w-4 h-4 rounded border transition-colors ${selected ? "bg-zinc-900 dark:bg-zinc-50 border-zinc-900 dark:border-zinc-50" : "border-zinc-300 dark:border-zinc-700"}`}>
            {selected && <svg viewBox="0 0 16 16" className="w-4 h-4 text-white dark:text-zinc-900"><path fill="currentColor" d="M6.5 11.5L3 8l1-1 2.5 2.5L11 5l1 1z"/></svg>}
          </div>
        </button>
      )}
      <a href={bookmark.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center shrink-0">
          {bookmark.favicon ? <img src={bookmark.favicon} alt="" className="w-5 h-5" /> : <ExternalLink className="w-4 h-4 text-zinc-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate text-zinc-900 dark:text-zinc-50">{bookmark.title}</div>
          <div className="text-xs text-zinc-400 truncate mt-0.5 font-mono">{collectionName ? `${collectionName} · ` : ""}{timeAgo} · {domain}</div>
        </div>
      </a>
      <div className="flex items-center gap-1 shrink-0 ml-2">
        <button onClick={() => setShowMenu(!showMenu)} className="p-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50">
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
      {menu}
    </div>
  );
}

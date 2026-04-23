"use client";

import { useState, useEffect, useRef } from "react";
import { type Bookmark, type Collection } from "@/lib/db/schema";
import { deleteBookmark, moveBookmark, renameBookmark } from "@/app/actions";
import { useDashboard } from "@/lib/dashboard-context";
import {
  MoreVertical, Pencil, Trash2, ArrowRight,
  ExternalLink,
} from "lucide-react";

type Props = {
  bookmark: Bookmark;
  collections?: Collection[];
  showCollection?: boolean;
  selected?: boolean;
  onSelect?: (id: number) => void;
  dragIds?: number[];
};

export function BookmarkCard({ bookmark, collections, showCollection, selected, onSelect, dragIds }: Props) {
  const { refresh } = useDashboard();
  const [showMenu, setShowMenu] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
        setShowMove(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleDelete() {
    if (!confirm("Delete this bookmark?")) return;
    await deleteBookmark(bookmark.id);
    await refresh();
  }

  async function handleMove(collectionId: number) {
    await moveBookmark(bookmark.id, collectionId);
    setShowMenu(false);
    setShowMove(false);
    await refresh();
  }

  async function handleRename() {
    const newTitle = prompt("Rename bookmark:", bookmark.title);
    if (!newTitle || newTitle.trim() === bookmark.title) return;
    await renameBookmark(bookmark.id, newTitle.trim());
    setShowMenu(false);
    await refresh();
  }

  const domain = new URL(bookmark.url).hostname.replace("www.", "");
  const timeAgo = new Date(bookmark.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  const collectionName = showCollection ? collections?.find(c => c.id === bookmark.collectionId)?.name : null;

  const menu = showMenu && (
    <div ref={menuRef} className="absolute right-0 top-10 z-20 bg-surface border border-border-hover rounded-lg shadow-floating py-1 min-w-[160px]">
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRename(); }}
        className="w-full text-left px-3 py-2 text-sm hover:bg-raised flex items-center gap-2 text-primary"
      >
        <Pencil className="w-4 h-4 text-secondary" /> Rename
      </button>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowMove(!showMove); }}
        className="w-full text-left px-3 py-2 text-sm hover:bg-raised flex items-center gap-2 text-primary"
      >
        <ArrowRight className="w-4 h-4 text-secondary" /> Move to...
      </button>
      {showMove && collections && (
        <div className="px-1 py-1 border-t border-border mt-1">
          {collections.filter(c => c.id !== bookmark.collectionId).map(c => (
            <button key={c.id} onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleMove(c.id); }} className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-raised text-secondary hover:text-primary">
              {c.name}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(); }}
        className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2 border-t border-border mt-1"
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
      className={`relative group flex items-center justify-between px-4 py-3 hover:bg-raised cursor-grab active:cursor-grabbing transition-all duration-150 border-b border-border last:border-0 ${selected ? "bg-raised" : ""} ${isDragging ? "opacity-50 scale-[0.98]" : ""}`}
      style={{ transitionTimingFunction: "cubic-bezier(0.25, 1, 0.5, 1)" }}>
      {onSelect && (
        <button onClick={() => onSelect(bookmark.id)} className="shrink-0 mr-3">
          <div className={`w-4 h-4 rounded border transition-colors ${selected ? "bg-primary border-primary" : "border-border"}`}>
            {selected && <svg viewBox="0 0 16 16" className="w-4 h-4 text-void"><path fill="currentColor" d="M6.5 11.5L3 8l1-1 2.5 2.5L11 5l1 1z"/></svg>}
          </div>
        </button>
      )}
      <a href={bookmark.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-raised border border-border flex items-center justify-center shrink-0">
          {bookmark.favicon ? <img src={bookmark.favicon} alt="" className="w-5 h-5" /> : <ExternalLink className="w-4 h-4 text-muted" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate text-primary">{bookmark.title}</div>
          <div className="text-xs text-secondary truncate mt-0.5 font-mono">{collectionName ? `${collectionName} · ` : ""}{timeAgo} · {domain}</div>
        </div>
      </a>
      <div className="flex items-center gap-1 shrink-0 ml-2">
        <button onClick={() => setShowMenu(!showMenu)} className="p-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-secondary hover:text-primary">
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
      {menu}
    </div>
  );
}

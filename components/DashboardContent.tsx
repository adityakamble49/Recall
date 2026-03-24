"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { type Bookmark, type Collection } from "@/lib/db/schema";
import {
  getAllBookmarks, getBookmarkChecksum,
  createBookmark, createCollection, deleteCollection,
} from "@/app/actions";
import { DashboardProvider } from "@/lib/dashboard-context";
import { BookmarkCard } from "@/components/BookmarkCard";
import { InstantCapture } from "@/components/InstantCapture";
import { OpenTabGroupButton } from "@/components/OpenTabGroupButton";
import { EditableCollectionName } from "@/components/EditableCollectionName";
import { MergeCollections } from "@/components/MergeCollections";
import {
  FolderOpen, Bookmark as BookmarkIcon, Plus,
  X, Trash2,
} from "lucide-react";

type Props = {
  collections: (Collection & { bookmarkCount: number })[];
  allBookmarks: Bookmark[];
};

export function DashboardContent({ collections, allBookmarks }: Props) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(allBookmarks);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showNewCollection, setShowNewCollection] = useState(false);

  const [addUrl, setAddUrl] = useState("");
  const [addTitle, setAddTitle] = useState("");
  const [addCollection, setAddCollection] = useState<number | undefined>(undefined);
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  const [newColName, setNewColName] = useState("");
  const [newColLoading, setNewColLoading] = useState(false);

  const checksumRef = useRef({ count: allBookmarks.length, latestId: allBookmarks[0]?.id ?? 0 });

  const filtered = activeId === null
    ? bookmarks.slice(0, 20)
    : bookmarks.filter((b) => b.collectionId === activeId);

  const refresh = useCallback(async () => {
    const fresh = await getAllBookmarks();
    setBookmarks(fresh);
    checksumRef.current = { count: fresh.length, latestId: fresh[0]?.id ?? 0 };
  }, []);

  // Poll for cross-session changes
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const check = await getBookmarkChecksum();
        const prev = checksumRef.current;
        if (check.count !== prev.count || check.latestId !== prev.latestId) {
          await refresh();
        }
      } catch {}
    }, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Escape key
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (showAddForm) { setShowAddForm(false); return; }
      if (showNewCollection) { setShowNewCollection(false); setNewColName(""); return; }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showAddForm, showNewCollection]);

  async function handleAddBookmark(e: React.FormEvent) {
    e.preventDefault();
    if (!addUrl.trim() || !addTitle.trim()) return;
    setAddLoading(true);
    setAddError(null);
    try {
      const result = await createBookmark({
        title: addTitle,
        url: addUrl,
        collectionId: addCollection ?? activeId ?? undefined,
      });
      if (result.error) { setAddError(result.error); return; }
      setAddUrl("");
      setAddTitle("");
      setShowAddForm(false);
      await refresh();
    } finally {
      setAddLoading(false);
    }
  }

  async function handleNewCollection(e: React.FormEvent) {
    e.preventDefault();
    if (!newColName.trim()) return;
    setNewColLoading(true);
    try {
      await createCollection({ name: newColName });
      setNewColName("");
      setShowNewCollection(false);
    } finally {
      setNewColLoading(false);
    }
  }

  async function handleDeleteCollection(id: number) {
    const col = collections.find((c) => c.id === id);
    if (!confirm(`Delete "${col?.name}"? All bookmarks in this collection will be uncategorized.`)) return;
    await deleteCollection(id);
    if (activeId === id) setActiveId(null);
    await refresh();
  }

  const activeCollection = collections.find((c) => c.id === activeId);
  const urls = filtered.map((b) => b.url);

  return (
    <DashboardProvider value={{ bookmarks, collections, refresh }}>
      <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-2 font-mono">Dashboard</p>
      <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-8">
        <span className="font-mono">{bookmarks.length}</span> <span className="text-zinc-300 dark:text-zinc-700">bookmarks</span>
      </h1>
      <div className="mb-16">
        <InstantCapture />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-12 min-w-0">
        {/* Left: Collections */}
        <aside>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xs font-semibold font-mono uppercase tracking-wider text-zinc-400">Collections</h2>
            <MergeCollections collections={collections} />
          </div>

          <div className="space-y-1">
            <button
              onClick={() => setActiveId(null)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                activeId === null
                  ? "bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900"
                  : "border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:border-zinc-300 dark:hover:border-zinc-700"
              }`}
            >
              <BookmarkIcon className="w-4 h-4" />
              <span className="text-sm font-medium flex-1">All Bookmarks</span>
            </button>

            {collections.map((col) => (
              <div key={col.id} className="group relative">
                <button
                  onClick={() => setActiveId(col.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                    activeId === col.id
                      ? "bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900"
                      : "border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                >
                  <FolderOpen className="w-4 h-4" />
                  <span className="text-sm font-medium flex-1 truncate">{col.name}</span>
                  <span className={`text-xs tabular-nums font-mono ${activeId === col.id ? "opacity-70" : "text-zinc-400"}`}>
                    {col.bookmarkCount}
                  </span>
                </button>
                {activeId === col.id && (
                  <button
                    onClick={() => handleDeleteCollection(col.id)}
                    className="absolute right-12 top-1/2 -translate-y-1/2 p-1 text-white/60 hover:text-white dark:text-zinc-900/60 dark:hover:text-zinc-900"
                    title="Delete collection"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}

            {showNewCollection ? (
              <form onSubmit={handleNewCollection} className="flex gap-2 mt-2">
                <input
                  autoFocus
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  placeholder="Collection name"
                  className="flex-1 px-3 py-2 text-base md:text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-50"
                />
                <button type="submit" disabled={newColLoading} className="px-3 py-2 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg text-sm font-medium disabled:opacity-50">
                  Add
                </button>
                <button type="button" onClick={() => { setShowNewCollection(false); setNewColName(""); }} className="p-2 text-zinc-400">
                  <X className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <button
                onClick={() => setShowNewCollection(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 hover:border-zinc-300 transition-colors mt-2"
              >
                <Plus className="w-4 h-4" /> New collection
              </button>
            )}
          </div>
        </aside>

        {/* Right: Bookmarks */}
        <section className="min-w-0">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              {activeCollection ? (
                <EditableCollectionName id={activeCollection.id} name={activeCollection.name} />
              ) : (
                <h2 className="text-xs font-semibold font-mono uppercase tracking-wider text-zinc-400">Recent</h2>
              )}
            </div>
            <div className="flex items-center gap-2">
              {activeCollection && urls.length > 0 && (
                <OpenTabGroupButton urls={urls} name={activeCollection.name} />
              )}
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  showAddForm
                    ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50"
                    : "bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200"
                }`}
              >
                {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showAddForm ? "Cancel" : "Add"}
              </button>
            </div>
          </div>

          {showAddForm && (
            <form onSubmit={handleAddBookmark} className="mb-6 p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  autoFocus
                  type="url"
                  value={addUrl}
                  onChange={(e) => setAddUrl(e.target.value)}
                  placeholder="URL"
                  required
                  className="px-3 py-2 text-base md:text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-50 font-mono"
                />
                <input
                  type="text"
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  placeholder="Title"
                  required
                  className="px-3 py-2 text-base md:text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-50"
                />
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={addCollection ?? activeId ?? ""}
                  onChange={(e) => setAddCollection(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="flex-1 px-3 py-2 text-base md:text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-50"
                >
                  <option value="">No collection</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="px-4 py-2 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-sm font-medium rounded-lg disabled:opacity-50"
                >
                  {addLoading ? "Saving..." : "Save"}
                </button>
              </div>
              {addError && <p className="text-xs font-medium text-red-600">{addError}</p>}
            </form>
          )}

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
              <BookmarkIcon className="w-10 h-10 text-zinc-200 dark:text-zinc-800 mb-4" />
              <p className="text-sm text-zinc-400">
                {activeCollection ? "No bookmarks in this collection" : "No bookmarks yet"}
              </p>
            </div>
          ) : (
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
              {filtered.map((bm) => (
                <BookmarkCard key={bm.id} bookmark={bm} variant="list" collections={collections} />
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardProvider>
  );
}

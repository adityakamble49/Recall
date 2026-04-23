"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { type Bookmark, type Collection } from "@/lib/db/schema";
import {
  getAllBookmarks, getBookmarkChecksum,
  createBookmark, createCollection, deleteCollection, updateCollection,
  restoreCollection, permanentlyDeleteCollection, getDeletedCollections,
  getCollectionsWithCount, bulkMoveBookmarks, bulkDeleteBookmarks,
} from "@/app/actions";
import { DashboardProvider } from "@/lib/dashboard-context";
import { BookmarkCard } from "@/components/BookmarkCard";
import { InstantCapture } from "@/components/InstantCapture";
import { MergeCollections } from "@/components/MergeCollections";
import {
  FolderOpen, Bookmark as BookmarkIcon, Plus,
  X, Trash2, Pencil, Undo2, ChevronDown, CheckSquare,
} from "lucide-react";

type Props = {
  collections: (Collection & { bookmarkCount: number })[];
  allBookmarks: Bookmark[];
  deletedCollections: Collection[];
};

export function DashboardContent({ collections: initialCollections, allBookmarks, deletedCollections: initialDeleted }: Props) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(allBookmarks);
  const [collections, setCollections] = useState(initialCollections);
  const [deletedCollections, setDeletedCollections] = useState<Collection[]>(initialDeleted);
  const [showTrash, setShowTrash] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [dropSuccessId, setDropSuccessId] = useState<number | null>(null);
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
    const [fresh, cols, deleted] = await Promise.all([
      getAllBookmarks(), getCollectionsWithCount(), getDeletedCollections(),
    ]);
    setBookmarks(fresh);
    setCollections(cols);
    setDeletedCollections(deleted);
    checksumRef.current = { count: fresh.length, latestId: fresh[0]?.id ?? 0 };
  }, []);

  // Poll for cross-session changes
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const check = await getBookmarkChecksum();
        const prev = checksumRef.current;
        if (check.count !== prev.count || check.latestId !== prev.latestId) {
          refresh();
        }
      } catch {}
    }, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Escape key
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (selectedIds.size > 0 || selectMode) { setSelectedIds(new Set()); setSelectMode(false); return; }
      if (showAddForm) { setShowAddForm(false); return; }
      if (showNewCollection) { setShowNewCollection(false); setNewColName(""); return; }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showAddForm, showNewCollection, selectedIds, selectMode]);

  async function handleAddBookmark(e: React.FormEvent) {
    e.preventDefault();
    if (!addUrl.trim() || !addTitle.trim()) return;
    setAddLoading(true);
    setAddError(null);
    try {
      const result = await createBookmark({
        title: addTitle,
        url: addUrl,
        collectionId: addCollection ?? activeId ?? collections.find(c => c.isDefault)?.id,
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
      const result = await createCollection({ name: newColName });
      if (result.error) { alert(result.error); return; }
      setNewColName("");
      setShowNewCollection(false);
      await refresh();
    } finally {
      setNewColLoading(false);
    }
  }

  async function handleDeleteCollection(id: number) {
    const col = collections.find((c) => c.id === id);
    if (!confirm(`Move "${col?.name}" to trash?`)) return;
    await deleteCollection(id);
    if (activeId === id) setActiveId(null);
    await refresh();
  }

  async function handleRestore(id: number) {
    await restoreCollection(id);
    await refresh();
  }

  async function handlePermanentDelete(id: number) {
    const col = deletedCollections.find((c) => c.id === id);
    if (!confirm(`Permanently delete "${col?.name}" and all its bookmarks? This cannot be undone.`)) return;
    await permanentlyDeleteCollection(id);
    await refresh();
  }

  async function handleRenameCollection(id: number, currentName: string) {
    const newName = prompt("Rename collection:", currentName);
    if (!newName || newName.trim() === currentName) return;
    await updateCollection(id, { name: newName.trim() });
    await refresh();
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleBulkMove(collectionId: number) {
    await bulkMoveBookmarks([...selectedIds], collectionId);
    setSelectedIds(new Set());
    await refresh();
  }

  async function handleBulkDelete() {
    if (!confirm(`Delete ${selectedIds.size} bookmark${selectedIds.size > 1 ? "s" : ""}?`)) return;
    await bulkDeleteBookmarks([...selectedIds]);
    setSelectedIds(new Set());
    await refresh();
  }

  const activeCollection = collections.find((c) => c.id === activeId);

  async function handleDrop(collectionId: number, e: React.DragEvent) {
    e.preventDefault();
    setDragOverId(null);
    try {
      const ids: number[] = JSON.parse(e.dataTransfer.getData("text/plain"));
      if (ids.length === 0) return;
      setDropSuccessId(collectionId);
      setTimeout(() => setDropSuccessId(null), 300);
      await bulkMoveBookmarks(ids, collectionId);
      setSelectedIds(new Set());
      setSelectMode(false);
      await refresh();
    } catch {}
  }

  return (
    <DashboardProvider value={{ bookmarks, collections, refresh }}>
      <p className="text-xs font-medium text-muted uppercase tracking-widest mb-2 font-mono">Dashboard</p>
      <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-8 text-primary">
        <span className="font-mono">{bookmarks.length}</span> <span className="text-muted">bookmarks</span>
      </h1>
      <div className="mb-16">
        <InstantCapture />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-12 min-w-0">
        {/* Left: Collections */}
        <aside>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xs font-semibold font-mono uppercase tracking-wider text-muted">Collections</h2>
            <MergeCollections collections={collections} />
          </div>

          <div className="space-y-1">
            <button
              onClick={() => { setActiveId(null); setSelectedIds(new Set()); setSelectMode(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors border ${
                activeId === null
                  ? "bg-primary text-void border-primary"
                  : "border-border bg-surface hover:border-border-hover text-secondary hover:text-primary"
              }`}
            >
              <BookmarkIcon className="w-4 h-4" />
              <span className="text-sm font-medium flex-1">All Bookmarks</span>
            </button>

            {collections.map((col) => (
              <div
                key={col.id}
                className="group relative"
                onDragOver={(e) => { e.preventDefault(); setDragOverId(col.id); }}
                onDragLeave={() => setDragOverId(null)}
                onDrop={(e) => handleDrop(col.id, e)}
              >
                <button
                  onClick={() => { setActiveId(col.id); setSelectedIds(new Set()); setSelectMode(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 border ${
                    dragOverId === col.id || dropSuccessId === col.id
                      ? "border-primary bg-raised"
                      : activeId === col.id
                        ? "border-primary bg-primary text-void"
                        : "border-border bg-surface hover:border-border-hover text-secondary hover:text-primary"
                  }`}
                  style={{ transitionTimingFunction: "cubic-bezier(0.25, 1, 0.5, 1)" }}
                >
                  <FolderOpen className="w-4 h-4" />
                  <span className="text-sm font-medium flex-1 truncate">{col.name}</span>
                  <span className={`text-xs tabular-nums font-mono ${activeId === col.id ? "opacity-70" : "text-muted"}`}>
                    {col.bookmarkCount}
                  </span>
                </button>
                {activeId === col.id && !col.isDefault && (
                  <div className="absolute right-12 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    <button
                      onClick={() => handleRenameCollection(col.id, col.name)}
                      className="p-1 text-void/60 hover:text-void"
                      title="Rename collection"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteCollection(col.id)}
                      className="p-1 text-void/60 hover:text-void"
                      title="Delete collection"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
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
                  className="flex-1 px-3 py-2 text-base md:text-sm border border-border rounded-lg bg-raised text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button type="submit" disabled={newColLoading} className="px-3 py-2 bg-primary text-void rounded-lg text-sm font-medium disabled:opacity-50">
                  Add
                </button>
                <button type="button" onClick={() => { setShowNewCollection(false); setNewColName(""); }} className="p-2 text-muted hover:text-primary transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <button
                onClick={() => setShowNewCollection(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-xl text-sm text-muted hover:text-primary hover:border-border-hover transition-colors mt-2"
              >
                <Plus className="w-4 h-4" /> New collection
              </button>
            )}
          </div>

          {deletedCollections.length > 0 && (
            <div className="mt-6 px-1">
              <button
                onClick={() => setShowTrash(!showTrash)}
                className="flex items-center gap-1.5 text-xs font-semibold font-mono uppercase tracking-wider text-muted hover:text-secondary transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Trash ({deletedCollections.length})
                <ChevronDown className={`w-3 h-3 transition-transform ${showTrash ? "rotate-180" : ""}`} />
              </button>
              {showTrash && (
                <div className="space-y-1 mt-2">
                  {deletedCollections.map((col) => (
                    <div key={col.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-raised text-sm text-secondary">
                      <span className="flex-1 truncate">{col.name}</span>
                      <button onClick={() => handleRestore(col.id)} className="p-1 hover:text-primary transition-colors" title="Restore">
                        <Undo2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handlePermanentDelete(col.id)} className="p-1 hover:text-destructive transition-colors" title="Delete permanently">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>

        {/* Right: Bookmarks */}
        <section className="min-w-0">
          <div className="flex items-center justify-between mb-5 px-1">
            <div className="flex items-center gap-3">
              {activeCollection ? (
                <h2 className="text-sm font-semibold text-primary">{activeCollection.name}</h2>
              ) : (
                <h2 className="text-xs font-semibold font-mono uppercase tracking-wider text-muted">Recent</h2>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setSelectMode(!selectMode); if (selectMode) setSelectedIds(new Set()); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  selectMode
                    ? "bg-raised text-primary"
                    : "text-secondary hover:text-primary border border-border hover:border-border-hover"
                }`}
              >
                <CheckSquare className="w-4 h-4" />
                {selectMode ? "Done" : "Select"}
              </button>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  showAddForm
                    ? "bg-raised text-primary"
                    : "bg-primary text-void hover:opacity-90 transition-opacity"
                }`}
              >
                {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showAddForm ? "Cancel" : "Add"}
              </button>
            </div>
          </div>

          {showAddForm && (
            <form onSubmit={handleAddBookmark} className="mb-6 p-4 border border-border rounded-xl bg-surface space-y-3 shadow-card">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  autoFocus
                  type="url"
                  value={addUrl}
                  onChange={(e) => setAddUrl(e.target.value)}
                  placeholder="URL"
                  required
                  className="px-3 py-2 text-base md:text-sm border border-border rounded-lg bg-raised text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                />
                <input
                  type="text"
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  placeholder="Title"
                  required
                  className="px-3 py-2 text-base md:text-sm border border-border rounded-lg bg-raised text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={addCollection ?? activeId ?? collections.find(c => c.isDefault)?.id ?? ""}
                  onChange={(e) => setAddCollection(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="flex-1 px-3 py-2 text-base md:text-sm border border-border rounded-lg bg-raised text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2371717a%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_10px_center] pr-8"
                >
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="px-4 py-2 bg-primary text-void text-sm font-medium rounded-lg disabled:opacity-50"
                >
                  {addLoading ? "Saving..." : "Save"}
                </button>
              </div>
              {addError && <p className="text-xs font-medium text-destructive">{addError}</p>}
            </form>
          )}

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border rounded-xl bg-void/50">
              <BookmarkIcon className="w-10 h-10 text-muted/20 mb-4" />
              <p className="text-sm text-muted">
                {activeCollection ? "No bookmarks in this collection" : "No bookmarks yet"}
              </p>
            </div>
          ) : (
            <div className="border border-border rounded-xl bg-surface divide-y divide-border overflow-visible shadow-card">
              {filtered.map((bm) => (
                <BookmarkCard key={bm.id} bookmark={bm} collections={collections} showCollection={activeId === null} selected={selectedIds.has(bm.id)} onSelect={selectMode ? toggleSelect : undefined} dragIds={selectMode && selectedIds.has(bm.id) ? [...selectedIds] : undefined} />
              ))}
            </div>
          )}
        </section>
      </div>

      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-3 bg-primary text-void rounded-xl shadow-floating z-50 border border-primary/10">
          <span className="text-sm font-mono font-bold">{selectedIds.size} selected</span>
          <select
            onChange={async (e) => { if (e.target.value) { await handleBulkMove(parseInt(e.target.value)); } e.target.value = ""; }}
            className="px-2 py-1 text-xs rounded-md bg-void/10 text-void border-none focus:outline-none"
          >
            <option value="">Move to...</option>
            {collections.map(c => <option key={c.id} value={c.id} className="text-primary">{c.name}</option>)}
          </select>
          <button onClick={handleBulkDelete} className="px-3 py-1 text-xs font-medium bg-destructive text-void rounded-md hover:opacity-90">
            Delete
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="px-2 py-1 text-xs text-void/50 hover:text-void transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </DashboardProvider>
  );
}

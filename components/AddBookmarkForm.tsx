"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBookmark, createCollection } from "@/app/actions";
import { type Collection } from "@/lib/db/schema";

type Props = {
  collections: Collection[];
  preselectedCollection?: number;
  isCollectionMode: boolean;
};

export function AddBookmarkForm({ collections, preselectedCollection, isCollectionMode }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Bookmark fields
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [selectedCollection, setSelectedCollection] = useState<number | undefined>(preselectedCollection);

  // Collection fields
  const [colName, setColName] = useState("");
  const [colDescription, setColDescription] = useState("");
  const [showNewCollection, setShowNewCollection] = useState(isCollectionMode);

  async function handleBookmarkSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || !title.trim()) return;
    setLoading(true);
    try {
      await createBookmark({ title, url, collectionId: selectedCollection });
      router.push(selectedCollection ? `/collections/${selectedCollection}` : "/");
    } finally {
      setLoading(false);
    }
  }

  async function handleCollectionSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!colName.trim()) return;
    setLoading(true);
    try {
      await createCollection({ name: colName, description: colDescription || undefined });
      router.push("/collections");
    } finally {
      setLoading(false);
    }
  }

  if (showNewCollection) {
    return (
      <div className="w-full max-w-xl bg-surface-container-lowest border border-outline-variant/20 rounded-xl overflow-hidden shadow-[0px_20px_40px_rgba(27,27,35,0.08)]">
        <div className="px-8 py-6 flex items-center justify-between bg-surface-container-high/30">
          <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">New Collection</h1>
          <button onClick={() => router.back()} className="text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleCollectionSubmit} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
              <span className="material-symbols-outlined text-[1rem]">folder</span> Name
            </label>
            <input
              type="text" value={colName} onChange={(e) => setColName(e.target.value)} required
              placeholder="e.g. Development, Design, Research"
              className="w-full bg-surface-container-high border-none rounded-md px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-0"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
              <span className="material-symbols-outlined text-[1rem]">description</span> Description
            </label>
            <input
              type="text" value={colDescription} onChange={(e) => setColDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full bg-surface-container-high border-none rounded-md px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-0"
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full py-3 bg-gradient-to-br from-primary to-primary-container text-white font-bold rounded-md active:scale-[0.98] transition-all disabled:opacity-50"
          >
            Create Collection
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl bg-surface-container-lowest border border-outline-variant/20 rounded-xl overflow-hidden shadow-[0px_20px_40px_rgba(27,27,35,0.08)]">
      <div className="px-8 py-6 flex items-center justify-between bg-surface-container-high/30">
        <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">New Bookmark</h1>
        <button onClick={() => router.back()} className="text-on-surface-variant hover:text-primary transition-colors">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      <form onSubmit={handleBookmarkSubmit} className="p-8 space-y-8">
        {/* URL */}
        <div className="space-y-2">
          <label className="text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
            <span className="material-symbols-outlined text-[1rem]">link</span> Source URL
          </label>
          <div className="relative group">
            <input
              type="url" value={url} onChange={(e) => setUrl(e.target.value)} required
              placeholder="https://example.com/article"
              className="w-full bg-surface-container-high border-none rounded-md px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-0 peer"
            />
            <div className="absolute bottom-0 left-0 w-0 h-[2px] bg-primary-container peer-focus:w-full transition-all duration-300" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <label className="text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
            <span className="material-symbols-outlined text-[1rem]">title</span> Title
          </label>
          <div className="relative group">
            <input
              type="text" value={title} onChange={(e) => setTitle(e.target.value)} required
              placeholder="Article or Page Title"
              className="w-full bg-surface-container-high border-none rounded-md px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-0 peer"
            />
            <div className="absolute bottom-0 left-0 w-0 h-[2px] bg-primary-container peer-focus:w-full transition-all duration-300" />
          </div>
        </div>

        {/* Collection picker */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
              <span className="material-symbols-outlined text-[1rem]">category</span> Category
            </label>
            <select
              value={selectedCollection ?? ""}
              onChange={(e) => setSelectedCollection(e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-full bg-surface-container-high border-none rounded-md px-4 py-3 text-on-surface focus:ring-0"
            >
              <option value="">General</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {/* Mobile: chip style */}
          <div className="md:hidden flex flex-wrap gap-2">
            {collections.map((c) => (
              <button
                key={c.id} type="button"
                onClick={() => setSelectedCollection(c.id)}
                className={`px-4 py-2 rounded-full text-xs font-bold border-none flex items-center gap-1.5 active:scale-95 transition-all ${
                  selectedCollection === c.id
                    ? "bg-primary text-white shadow-sm"
                    : "bg-surface-container-highest text-on-surface hover:bg-surface-dim"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>folder</span>
                {c.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowNewCollection(true)}
              className="px-3 py-2 rounded-full border border-outline-variant/30 text-outline text-xs font-bold flex items-center gap-1.5 hover:bg-surface-container active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">add</span> New
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-6 flex flex-col md:flex-row gap-4 items-center justify-end">
          <button type="button" onClick={() => router.back()} className="w-full md:w-auto px-6 py-2.5 text-on-surface-variant font-bold text-sm hover:text-error transition-colors order-2 md:order-1">
            Cancel
          </button>
          {/* Mobile: full-width gradient CTA */}
          <button
            type="submit" disabled={loading}
            className="md:hidden w-full h-16 bg-gradient-to-br from-primary to-primary-container text-white rounded-xl font-bold text-lg flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            Save to Archive
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
          {/* Desktop */}
          <button
            type="submit" disabled={loading}
            className="hidden md:block px-8 py-2.5 bg-gradient-to-br from-primary to-primary-container text-on-primary font-bold text-sm rounded-md active:scale-95 transition-all shadow-[0px_4px_12px_rgba(67,67,213,0.3)] disabled:opacity-50"
          >
            Create Bookmark
          </button>
        </div>
      </form>
    </div>
  );
}

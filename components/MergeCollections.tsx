"use client";

import { useState, useEffect } from "react";
import { mergeCollections } from "@/app/actions";
import { type Collection } from "@/lib/db/schema";
import { X, GitMerge } from "lucide-react";

type Props = {
  collections: (Collection & { bookmarkCount: number })[];
};

export function MergeCollections({ collections }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [targetId, setTargetId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpen(false); setSelected(new Set()); setTargetId(null); }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open]);

  if (collections.length < 2) return null;

  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    if (targetId === id && !next.has(id)) setTargetId(null);
    setSelected(next);
  }

  async function handleMerge() {
    if (!targetId || selected.size < 2) return;
    const sourceIds = [...selected].filter((id) => id !== targetId);
    setLoading(true);
    try {
      await mergeCollections(sourceIds, targetId);
      setOpen(false);
      setSelected(new Set());
      setTargetId(null);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
        title="Merge collections"
      >
        <GitMerge className="w-4 h-4" />
      </button>
    );
  }

  const selectedArr = [...selected];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-lg w-full max-w-md overflow-hidden">
        <div className="px-5 py-4 flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-sm font-semibold">Merge Collections</h2>
          <button onClick={() => { setOpen(false); setSelected(new Set()); setTargetId(null); }} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-zinc-500">Select collections to merge, then pick the target to keep.</p>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {collections.map((col) => (
              <label key={col.id} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selected.has(col.id) ? "bg-zinc-100 dark:bg-zinc-900" : "hover:bg-zinc-50 dark:hover:bg-zinc-900/50"}`}>
                <input type="checkbox" checked={selected.has(col.id)} onChange={() => toggle(col.id)} className="accent-zinc-900 dark:accent-zinc-50" />
                <span className="flex-1 text-sm font-medium">{col.name}</span>
                <span className="text-xs font-mono text-zinc-400">{col.bookmarkCount}</span>
              </label>
            ))}
          </div>
          {selectedArr.length >= 2 && (
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">Keep as target</label>
              <select
                value={targetId ?? ""}
                onChange={(e) => setTargetId(parseInt(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-50"
              >
                <option value="" disabled>Select target...</option>
                {selectedArr.map((id) => {
                  const col = collections.find((c) => c.id === id);
                  return <option key={id} value={id}>{col?.name}</option>;
                })}
              </select>
            </div>
          )}
          <button
            onClick={handleMerge}
            disabled={loading || !targetId || selected.size < 2}
            className="w-full py-2.5 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-sm font-medium rounded-lg disabled:opacity-50"
          >
            {loading ? "Merging..." : `Merge ${selected.size} collections`}
          </button>
        </div>
      </div>
    </div>
  );
}

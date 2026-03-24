"use client";

import { useState } from "react";
import { mergeCollections } from "@/app/actions";
import { type Collection } from "@/lib/db/schema";

type Props = {
  collections: (Collection & { bookmarkCount: number })[];
};

export function MergeCollections({ collections }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [targetId, setTargetId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  if (collections.length < 2) return null;

  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    // If target was deselected, clear it
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
        className="px-4 py-2 bg-surface-container-highest text-on-surface text-sm font-bold rounded-md active:scale-95 transition-all"
      >
        Merge
      </button>
    );
  }

  const selectedArr = [...selected];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/20 backdrop-blur-sm p-4">
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 shadow-lg w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 flex justify-between items-center bg-surface-container-high/30">
          <h2 className="text-lg font-extrabold">Merge Collections</h2>
          <button onClick={() => { setOpen(false); setSelected(new Set()); setTargetId(null); }} className="text-on-surface-variant hover:text-primary">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-on-surface-variant">Select collections to merge, then pick the target to keep.</p>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {collections.map((col) => (
              <label key={col.id} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selected.has(col.id) ? "bg-primary/10" : "bg-surface-container-low hover:bg-surface-container"}`}>
                <input
                  type="checkbox"
                  checked={selected.has(col.id)}
                  onChange={() => toggle(col.id)}
                  className="accent-primary"
                />
                <span className="flex-1 text-sm font-bold">{col.name}</span>
                <span className="text-[10px] text-on-surface-variant">{col.bookmarkCount}</span>
              </label>
            ))}
          </div>

          {selectedArr.length >= 2 && (
            <div className="space-y-2">
              <label className="text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant">Keep as target</label>
              <select
                value={targetId ?? ""}
                onChange={(e) => setTargetId(parseInt(e.target.value))}
                className="w-full bg-surface-container-high border-none rounded-md px-4 py-3 text-on-surface focus:ring-0"
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
            className="w-full py-3 bg-gradient-to-br from-primary to-primary-container text-white font-bold rounded-md active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? "Merging..." : `Merge ${selected.size} collections`}
          </button>
        </div>
      </div>
    </div>
  );
}

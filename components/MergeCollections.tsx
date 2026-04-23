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
        className="p-1.5 text-muted hover:text-primary transition-colors"
        title="Merge collections"
      >
        <GitMerge className="w-4 h-4" />
      </button>
    );
  }

  const selectedArr = [...selected];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay-bg backdrop-blur-sm p-4">
      <div className="bg-surface rounded-2xl border border-border-hover shadow-floating w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 flex justify-between items-center border-b border-border">
          <h2 className="text-sm font-semibold text-primary">Merge Collections</h2>
          <button onClick={() => { setOpen(false); setSelected(new Set()); setTargetId(null); }} className="text-muted hover:text-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <p className="text-xs text-secondary">Select collections to merge, then pick the target to keep.</p>
          <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
            {collections.map((col) => (
              <label key={col.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${selected.has(col.id) ? "bg-raised border border-border" : "hover:bg-raised/50 border border-transparent"}`}>
                <input type="checkbox" checked={selected.has(col.id)} onChange={() => toggle(col.id)} className="accent-primary" />
                <span className="flex-1 text-sm font-medium text-primary">{col.name}</span>
                <span className="text-xs font-mono text-muted">{col.bookmarkCount}</span>
              </label>
            ))}
          </div>
          {selectedArr.length >= 2 && (
            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted">Keep as target</label>
              <div className="relative">
                <select
                  value={targetId ?? ""}
                  onChange={(e) => setTargetId(parseInt(e.target.value))}
                  className="w-full px-4 py-2.5 text-sm border border-border rounded-xl bg-raised text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none pr-10"
                >
                  <option value="" disabled>Select target...</option>
                  {selectedArr.map((id) => {
                    const col = collections.find((c) => c.id === id);
                    return <option key={id} value={id}>{col?.name}</option>;
                  })}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
              </div>
            </div>
          )}
          <div className="pt-2 flex gap-3">
             <button
              onClick={() => { setOpen(false); setSelected(new Set()); setTargetId(null); }}
              className="flex-1 py-2.5 bg-surface text-secondary border border-border hover:border-border-hover rounded-xl text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleMerge}
              disabled={loading || !targetId || selected.size < 2}
              className="flex-[2] py-2.5 bg-primary text-void text-sm font-medium rounded-xl disabled:opacity-50 hover:opacity-90 transition-opacity shadow-sm"
            >
              {loading ? "Merging..." : `Merge ${selected.size} collections`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { createBookmark } from "@/app/actions";

export function InstantCapture() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!url.trim()) return;
    setLoading(true);
    try {
      let title = url;
      try { title = new URL(url).hostname; } catch {}
      await createBookmark({ title, url });
      setUrl("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-surface-container-high rounded-xl p-4 flex flex-col gap-3 border border-outline-variant/20">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
        <span className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">Instant Capture</span>
      </div>
      <div className="relative flex items-center">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Paste URL here..."
          className="w-full bg-surface-container-highest border-none rounded-lg py-3 px-4 text-sm placeholder:text-outline/60 focus:ring-0 focus:border-b-2 focus:border-primary transition-all"
        />
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="absolute right-2 bg-primary text-white w-8 h-8 rounded-md flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-lg">add</span>
        </button>
      </div>
    </div>
  );
}

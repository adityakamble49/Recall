"use client";

import { useState } from "react";
import { createBookmark } from "@/app/actions";
import { Plus } from "lucide-react";

export function InstantCapture() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  async function handleSubmit() {
    if (!url.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      let title = url;
      try { title = new URL(url).hostname; } catch {}
      const result = await createBookmark({ title, url });
      if (result.error) {
        setMessage({ text: result.error, isError: true });
      } else {
        setUrl("");
        setMessage({ text: "Saved!", isError: false });
        setTimeout(() => setMessage(null), 2000);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        placeholder="Paste a URL to save..."
        className="w-full h-10 px-3 pr-10 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-50 placeholder:text-zinc-400"
      />
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="absolute right-1.5 top-1.5 p-1.5 rounded bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 disabled:opacity-50"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
      {message && (
        <p className={`text-xs mt-1.5 font-medium ${message.isError ? "text-red-600" : "text-zinc-500"}`}>{message.text}</p>
      )}
    </div>
  );
}

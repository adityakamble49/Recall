"use client";

import { useState } from "react";
import { createBookmark } from "@/app/actions";
import { useDashboard } from "@/lib/dashboard-context";
import { Plus } from "lucide-react";

export function InstantCapture() {
  const { refresh } = useDashboard();
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
        await refresh();
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
        placeholder="Paste a URL to save instantly..."
        className="w-full h-11 px-4 pr-12 text-base border border-border rounded-xl bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted transition-all"
      />
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="absolute right-1.5 top-1.5 p-2 rounded-lg bg-primary text-void disabled:opacity-50 transition-opacity"
      >
        <Plus className="w-4 h-4" strokeWidth={3} />
      </button>
      {message && (
        <p className={`text-xs mt-2 px-1 font-medium ${message.isError ? "text-destructive" : "text-secondary"}`}>{message.text}</p>
      )}
    </div>
  );
}

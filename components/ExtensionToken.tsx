"use client";

import { useState, useEffect } from "react";
import { Copy, Check, RefreshCw } from "lucide-react";

export function ExtensionToken() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/token").then((r) => r.json()).then((d) => setToken(d.token));
  }, []);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch("/api/token", { method: "POST" });
      const data = await res.json();
      setToken(data.token);
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (token) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <code className="text-xs font-mono flex-1 truncate text-zinc-600 dark:text-zinc-400">{token}</code>
          <button onClick={copy} className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 shrink-0">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Regenerate
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={generate}
      disabled={loading}
      className="px-4 py-2 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-sm font-medium rounded-lg disabled:opacity-50"
    >
      {loading ? "Generating..." : "Generate Token"}
    </button>
  );
}

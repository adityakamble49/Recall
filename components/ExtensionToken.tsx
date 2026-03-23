"use client";

import { useState, useEffect } from "react";

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

  return (
    <div className="flex flex-col gap-3">
      {token ? (
        <>
          <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
            <code className="text-xs flex-1 truncate opacity-90">{token}</code>
            <button onClick={copy} className="text-white/80 hover:text-white shrink-0">
              <span className="material-symbols-outlined text-sm">
                {copied ? "check" : "content_copy"}
              </span>
            </button>
          </div>
          <button
            onClick={generate}
            disabled={loading}
            className="w-full h-10 bg-white/10 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 active:scale-95 transition-transform border border-white/20 disabled:opacity-50"
          >
            Regenerate Token
          </button>
        </>
      ) : (
        <button
          onClick={generate}
          disabled={loading}
          className="w-full h-12 bg-white text-primary font-bold text-sm rounded-lg flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
        >
          {loading ? "Generating..." : "Generate Extension Token"}
        </button>
      )}
    </div>
  );
}

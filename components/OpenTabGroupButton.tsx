"use client";

import { ExternalLink } from "lucide-react";

export function OpenTabGroupButton({ urls, name }: { urls: string[]; name: string }) {
  function handleOpen() {
    urls.forEach((url) => window.open(url, "_blank"));
  }

  return (
    <button
      onClick={handleOpen}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 border border-zinc-200 dark:border-zinc-800 rounded-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
    >
      <ExternalLink className="w-3.5 h-3.5" /> Open all
    </button>
  );
}

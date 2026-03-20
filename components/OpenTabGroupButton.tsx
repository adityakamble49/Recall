"use client";

export function OpenTabGroupButton({ urls, name }: { urls: string[]; name: string }) {
  function handleOpen() {
    // Fallback: open all URLs in new tabs
    // Chrome extension can intercept via externally_connectable if installed
    urls.forEach((url) => window.open(url, "_blank"));
  }

  return (
    <>
      {/* Mobile */}
      <button
        onClick={handleOpen}
        className="md:hidden w-full py-4 px-6 bg-surface-container-highest text-on-surface font-bold text-sm tracking-tight rounded-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
      >
        <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>tab</span>
        Open as Tab Group
      </button>
      {/* Desktop */}
      <button
        onClick={handleOpen}
        className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-gradient-to-br from-primary to-primary-container text-white font-bold text-[0.75rem] uppercase tracking-wider rounded-md active:scale-95 transition-all shadow-[0px_4px_20px_rgba(93,95,239,0.2)]"
      >
        <span className="material-symbols-outlined text-[1.2rem]">tab_group</span>
        Open as Tab Group
      </button>
    </>
  );
}

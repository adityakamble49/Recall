"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const navItems = [
  { href: "/", icon: "bookmarks", label: "All Bookmarks" },
  { href: "/reading-list", icon: "menu_book", label: "Reading List" },
  { href: "/favorites", icon: "star", label: "Favorites" },
  { href: "/archive", icon: "archive", label: "Archive" },
];

const bottomItems = [
  { href: "/settings", icon: "settings", label: "Settings" },
  { href: "/help", icon: "help_outline", label: "Help" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col h-full py-8 w-64 bg-surface-container border-r border-outline-variant/20 shrink-0">
      <div className="px-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-container rounded-xl flex items-center justify-center text-on-primary">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              bookmarks
            </span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-on-surface leading-none">Library</h2>
            <p className="text-[0.6875rem] font-bold uppercase tracking-[0.05em] text-on-surface-variant/60">
              Precision Sorting
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-4 px-6 py-3 transition-all active:translate-x-1 ${
                isActive
                  ? "bg-surface-container-highest text-primary border-r-4 border-primary"
                  : "text-on-surface/70 hover:bg-surface-container-highest/50"
              }`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="text-[0.6875rem] font-bold uppercase tracking-[0.05em]">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="px-6 mt-auto pt-8 border-t border-outline-variant/10 flex flex-col gap-1">
        {bottomItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-4 py-3 text-on-surface/70 hover:text-primary transition-all active:translate-x-1"
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span className="text-[0.6875rem] font-bold uppercase tracking-[0.05em]">
              {item.label}
            </span>
          </Link>
        ))}
      </div>
    </aside>
  );
}

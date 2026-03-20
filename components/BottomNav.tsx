"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const items = [
  { href: "/", icon: "home", label: "Home" },
  { href: "/collections", icon: "folder_special", label: "Collections" },
  { href: "/settings", icon: "settings", label: "Settings" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-md rounded-2xl z-50 bg-surface/80 backdrop-blur-lg shadow-[0_4px_20px_rgba(27,27,35,0.04)] flex justify-around items-center h-16 px-4">
      {items.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center pb-1.5 active:scale-90 transition-all ${
              isActive
                ? "text-primary border-b-2 border-primary"
                : "text-on-surface-variant/50 hover:text-primary"
            }`}
          >
            <span
              className="material-symbols-outlined text-xl"
              style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {item.icon}
            </span>
            <span className="text-[10px] font-bold tracking-widest uppercase mt-0.5">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

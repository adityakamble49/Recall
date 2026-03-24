"use client";

import { createContext, useContext } from "react";
import { type Bookmark, type Collection } from "@/lib/db/schema";

type DashboardContextType = {
  bookmarks: Bookmark[];
  collections: (Collection & { bookmarkCount: number })[];
  refresh: () => Promise<void>;
};

const DashboardContext = createContext<DashboardContextType | null>(null);

export function DashboardProvider({ children, value }: { children: React.ReactNode; value: DashboardContextType }) {
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}

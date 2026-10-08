"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { MediaCategory, SiteSettings } from "@/types/content";

/**
 * Site-wide data that client components need (categories, release date,
 * socials). The root layout reads it from the database and provides it here,
 * so owner edits in the admin panel reach every component.
 */
export interface SiteData {
  categories: MediaCategory[];
  settings: Pick<SiteSettings, "release" | "launchMode" | "socials" | "announcement">;
}

const SiteDataContext = createContext<SiteData | null>(null);

export function SiteDataProvider({ value, children }: { value: SiteData; children: ReactNode }) {
  return <SiteDataContext.Provider value={value}>{children}</SiteDataContext.Provider>;
}

export function useSiteData(): SiteData {
  const v = useContext(SiteDataContext);
  if (!v) throw new Error("useSiteData must be used inside SiteDataProvider");
  return v;
}

export function useCategories() {
  return useSiteData().categories;
}

/** Category metadata by slug, with a readable fallback for unknown slugs. */
export function useCategory(slug: string): MediaCategory {
  const c = useCategories().find((x) => x.slug === slug);
  return c ?? { slug, label: slug, singular: slug, description: "", order: 999 };
}

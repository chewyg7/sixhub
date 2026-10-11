"use client";

import Link from "next/link";
import { Boxes } from "lucide-react";
import { usePreferences } from "@/lib/preferences";
import { useHydrated } from "./repo-bits";

/** The way into My repos: a small, quiet button that only exists once repos are turned on in Settings. */
export function RepoEntry() {
  const hydrated = useHydrated();
  const { repos } = usePreferences();
  if (!hydrated || !repos) return null;
  return (
    <Link href="/media/repos" aria-label="My repos" title="My repos" className="flex size-8 items-center justify-center rounded-full text-white/25 transition-colors hover:bg-white/10 hover:text-white">
      <Boxes className="size-4" />
    </Link>
  );
}

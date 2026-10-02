"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import type { MediaItem } from "@/types/content";
import { Skeleton } from "@/components/ui/states";

function ViewerSkeleton() {
  return (
    <div className="flex h-[100dvh] flex-col bg-bg" aria-busy="true" aria-label="Loading Media Viewer">
      <div className="h-12 border-b border-divider" />
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-[280px] space-y-2 border-r border-divider bg-surface p-3 lg:block">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <div className="grid grid-cols-2 gap-2 pt-2">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="aspect-[16/10] w-full" />
            ))}
          </div>
        </div>
        <div className="flex flex-1 flex-col">
          <div className="h-11 border-b border-divider bg-surface" />
          <div className="flex-1 bg-canvas" />
        </div>
        <div className="hidden w-[320px] border-l border-divider bg-surface lg:block" />
      </div>
    </div>
  );
}

// The viewer is a client-only application (media elements, canvas, persisted layout).
const ViewerApp = dynamic(() => import("./components/viewer-app").then((m) => m.ViewerApp), { ssr: false, loading: ViewerSkeleton });

export function ViewerLoader({ items }: { items: MediaItem[] }) {
  return (
    <Suspense fallback={<ViewerSkeleton />}>
      <ViewerApp items={items} />
    </Suspense>
  );
}

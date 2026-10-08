"use client";

import { useMemo } from "react";
import type { MediaItem } from "@/types/content";
import { useLightbox } from "@/components/media/lightbox-context";
import { FontFamilyTester } from "@/components/media/font-tester";
import { styleWeight } from "@/lib/media/font-family";

/** A font family's folder: every style in your text; a row opens the full tester. */
export function FontFamilySection({ fonts }: { fonts: MediaItem[] }) {
  const { open } = useLightbox();
  const styles = useMemo(() => [...fonts].sort((a, b) => styleWeight(a.font?.style ?? "") - styleWeight(b.font?.style ?? "")), [fonts]);
  return <FontFamilyTester styles={styles} onOpen={(i) => open(styles, i)} />;
}

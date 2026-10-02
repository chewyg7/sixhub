"use client";

import { useEffect, type ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { LightboxProvider } from "@/components/media/lightbox-context";
import { CommandPaletteProvider } from "@/features/search/command-palette";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { Cursor } from "@/components/motion/cursor";
import { AmbientBackground } from "@/components/motion/ambient";
import { Intro } from "@/components/motion/intro";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    (window as unknown as { __ghHydrated?: boolean }).__ghHydrated = true;
  }, []);
  return (
    <ToastProvider>
      <SmoothScroll>
        <LightboxProvider>
          <CommandPaletteProvider>
            <AmbientBackground />
            {children}
            <Cursor />
            <Intro />
          </CommandPaletteProvider>
        </LightboxProvider>
      </SmoothScroll>
    </ToastProvider>
  );
}

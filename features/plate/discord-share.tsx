"use client";

import { useState } from "react";
import { ArrowUpRight, Check, ClipboardCopy, Download, Loader2 } from "lucide-react";
import { DiscordIcon } from "@/components/layout/social-links";
import { cn } from "@/lib/cn";

export interface DiscordInvite {
  invite: string;
  members: number | null;
}

type State = "idle" | "working" | "copied" | "saved";

/**
 * "Show it off" banner under the plate creator: copies the plate (as you see
 * it, 2D or 3D) to the clipboard and opens the Discord, so posting it is a
 * paste away. Where the browser can't put images on the clipboard, it saves
 * the PNG instead.
 */
export function DiscordShare({ discord, getImage, fileName, className }: { discord: DiscordInvite; getImage: () => Promise<Blob | null>; fileName: string; className?: string }) {
  const [state, setState] = useState<State>("idle");

  const copy = async () => {
    setState("working");
    const blob = getImage();
    try {
      // The promise form keeps Safari's user-gesture check happy.
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob.then((b) => b ?? Promise.reject(new Error("No image"))) })]);
      setState("copied");
    } catch {
      const b = await blob.catch(() => null);
      if (!b) return setState("idle");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      setState("saved");
    }
    setTimeout(() => setState("idle"), 4000);
  };

  const fans = discord.members ? `${discord.members.toLocaleString("en-US")} fans` : "The community";
  return (
    <section
      aria-labelledby="plate-discord-h"
      className={cn("relative mt-3 overflow-hidden rounded-[32px] border border-white/10 bg-[#100d1a] shadow-[0_30px_80px_-40px_rgb(88_101_242/0.7)]", className)}
    >
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(110deg,rgb(16_13_26)_20%,rgb(43_32_110/0.9)_60%,rgb(255_79_163/0.6))]" />
      <div aria-hidden className="absolute -right-24 -bottom-40 size-[420px] rounded-full bg-[radial-gradient(closest-side,rgb(88_101_242/0.55),transparent)]" />
      <div className="relative flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:px-10">
        <div className="flex min-w-0 items-start gap-5">
          <span className="hidden size-16 shrink-0 items-center justify-center bg-[#5865F2] ios-squircle sm:flex">
            <DiscordIcon className="size-8 text-white" />
          </span>
          <div className="min-w-0">
            <h2 id="plate-discord-h" className="display-xl text-[38px] leading-[0.92] sm:text-[52px]">
              Show it off on Discord
            </h2>
            <p className="mt-2 max-w-xl text-[15.5px] leading-relaxed text-white/75">
              {fans} in the GTA 6 Hub Discord want to see your plate. Copy it, open the server and paste it into the chat.
            </p>
            <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-semibold text-white/55">
              <li>
                <span className="text-white">1</span> Copy your plate
              </li>
              <li>
                <span className="text-white">2</span> Open the Discord
              </li>
              <li>
                <span className="text-white">3</span> Paste it in the chat
              </li>
            </ol>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={copy}
            disabled={state === "working"}
            className={cn(
              "inline-flex h-14 items-center justify-center gap-2 rounded-full px-6 text-[15.5px] font-bold transition-[transform,background-color] duration-300 hover:scale-[1.03] active:scale-95",
              state === "copied" || state === "saved" ? "bg-[#23a55a] text-white" : "bg-white text-[#1e1b3a] hover:bg-white/90",
            )}
          >
            {state === "working" ? (
              <Loader2 className="size-5 animate-spin" />
            ) : state === "copied" ? (
              <Check className="size-5" />
            ) : state === "saved" ? (
              <Download className="size-5" />
            ) : (
              <ClipboardCopy className="size-5" />
            )}
            {state === "copied" ? "Copied, now paste it" : state === "saved" ? "Saved, drop it in Discord" : "Copy my plate"}
          </button>
          <a
            href={discord.invite}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex h-14 items-center justify-center gap-2.5 rounded-full bg-[#5865F2] px-6 text-[15.5px] font-bold text-white shadow-[0_14px_40px_-12px_rgb(88_101_242/0.9)] transition-[transform,background-color] duration-300 hover:scale-[1.03] hover:bg-[#6b77f5] active:scale-95"
          >
            <DiscordIcon className="size-5" /> Open the Discord
            <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </div>
      </div>
    </section>
  );
}

import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { SITE } from "@/lib/site";
import { PREFS_BOOT_SCRIPT } from "@/lib/preferences-script";
import { getCategories, getSettings } from "@/lib/content";
import { Providers } from "./providers";
import "./globals.css";

/** GTA Art Deco — the site's single typeface. */
const deco = localFont({
  src: [
    { path: "./fonts/GTAArtDeco-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/GTAArtDeco-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/GTAArtDeco-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-deco",
  display: "swap",
});

/** Condensed cut for giant display headlines. */
const decoCondensed = localFont({
  src: [{ path: "./fonts/GTAArtDeco-Condensed-Bold.woff2", weight: "700", style: "normal" }],
  variable: "--font-deco-condensed",
  display: "swap",
});

/** Heaviest condensed cut, available as `font-heavy`. Not preloaded: it only downloads where it's used. */
const decoHeavy = localFont({
  src: [{ path: "./fonts/GTAArtDeco-Condensed-Heavy.woff2", weight: "900", style: "normal" }],
  variable: "--font-deco-heavy",
  display: "swap",
  preload: false,
});

/** Title and description come from the site editor, so owners can change them without a deploy. */
export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getSettings();
  return {
    metadataBase: new URL(SITE.url),
    title: { default: site.title, template: `%s · ${SITE.name}` },
    description: site.description,
    applicationName: SITE.name,
    openGraph: { type: "website", siteName: SITE.name, url: SITE.url, title: site.title, description: site.description },
    twitter: { card: "summary_large_image", title: site.title, description: site.description },
    alternates: { canonical: "/" },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0e0c12" },
    { media: "(prefers-color-scheme: light)", color: "#f5f4f1" },
  ],
  colorScheme: "dark light",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [categories, settings] = await Promise.all([getCategories(), getSettings()]);
  const siteData = { categories, settings: { release: settings.release, launchMode: settings.launchMode, socials: settings.socials, announcement: settings.announcement } };
  return (
    <html lang="en" data-theme="dark" className={`${deco.variable} ${decoCondensed.variable} ${decoHeavy.variable}`} suppressHydrationWarning>
      <head>
        {/* Apply saved theme/motion before first paint (no flash). */}
        <script dangerouslySetInnerHTML={{ __html: PREFS_BOOT_SCRIPT }} />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[2000] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-[13px] focus:font-semibold focus:text-primary-text"
        >
          Skip to content
        </a>
        <Providers siteData={siteData}>{children}</Providers>
      </body>
    </html>
  );
}

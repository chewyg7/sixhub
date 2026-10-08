import type { Metadata } from "next";

/** The admin panel is never indexed (also sent as an X-Robots-Tag header by proxy.ts). */
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · GTA 6 Hub" },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function ChewyLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { NextConfig } from "next";

const prod = process.env.NODE_ENV === "production";

/** Headers on every response. The admin panel adds a strict CSP on top (proxy.ts). */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  ...(prod ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Native modules run on the server only.
  serverExternalPackages: ["better-sqlite3", "sharp", "ffmpeg-static"],
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // One address for search engines: www.gtasixhub.com sends visitors to gtasixhub.com.
  async redirects() {
    return [{ source: "/:path*", has: [{ type: "host", value: "www.gtasixhub.com" }], destination: "https://gtasixhub.com/:path*", permanent: true }];
  },
  // Team profiles live at /@username (an "@" folder would be a parallel route, so it maps to /u/).
  async rewrites() {
    return [{ source: "/@:username", destination: "/u/:username" }];
  },
};

export default nextConfig;

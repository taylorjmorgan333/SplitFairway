/**
 * Enforcing policy that matches what this app actually loads.
 *
 * Next.js injects inline bootstrap scripts and the phone demo uses
 * inline style attributes. This repo does not attach a per-request
 * nonce in middleware, so script-src and style-src allow 'unsafe-inline'.
 * 'unsafe-eval' stays for the dev server and for libraries that still
 * compile a small function at runtime. Dropping either of those without
 * a nonce would blank the page, which is why this is the compatible
 * policy rather than a strict one shipped as report-only only.
 *
 * The same policy is also sent as Content-Security-Policy-Report-Only
 * so a browser console (or a report-uri added later) shows violations
 * without a second, surprise policy. There is no report-uri here on
 * purpose — that would send request data to a collector this project
 * does not run.
 *
 * connect-src is this origin plus Supabase (HTTPS and websocket).
 * Fonts are self-hosted by next/font. Images are local, data/blob, or
 * Supabase storage.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Nav/product repositioning: Dashboard was renamed Home. Keeps any
  // bookmarked/linked /dashboard URL working (requirement: preserve
  // existing URLs, redirect where routes move) without keeping a
  // second copy of the page around -- src/app/(app)/home/page.tsx is
  // the only real implementation now.
  async redirects() {
    return [
      { source: "/dashboard", destination: "/home", permanent: false },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

// Loud, hard-to-miss build-time reminder — not a build failure, since a
// preview/staging build shouldn't be blocked by it, but a production
// build silently shipping a "support email not configured" notice to
// real users is exactly the kind of thing that should show up in the
// Vercel build log, not just be discoverable by clicking around later.
if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_SUPPORT_EMAIL) {
  console.warn(
    "\n⚠️  NEXT_PUBLIC_SUPPORT_EMAIL is not set. The Contact and data-deletion pages will " +
      "show a visible \"support email not configured\" notice instead of a real address. " +
      "Set it in your production environment before real users see these pages.\n",
  );
}

export default nextConfig;

import type { MetadataRoute } from "next";

// Everything under these prefixes is either behind auth (middleware
// redirects a crawler with no session straight to /login anyway) or,
// for /invite, carries a per-invitation secret token in the URL itself —
// none of it should be crawled or indexed regardless.
const DISALLOWED_PREFIXES = [
  "/dashboard",
  "/trips",
  "/account",
  "/invite",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/unauthorized",
  "/account-deleted",
  "/api",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: DISALLOWED_PREFIXES,
    },
    sitemap: "https://www.splitfairwaygolf.com/sitemap.xml",
  };
}

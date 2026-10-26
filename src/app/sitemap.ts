import type { MetadataRoute } from "next";

const ORIGIN = "https://www.splitfairwaygolf.com";

// Only public, canonical, content-bearing pages — no auth routes, no
// dashboards/trip pages, no /invite/[token] (each URL carries a secret
// token), no API routes, no account pages. See src/app/robots.ts for the
// matching disallow list.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: `${ORIGIN}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${ORIGIN}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    {
      url: `${ORIGIN}/legal/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${ORIGIN}/legal/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${ORIGIN}/legal/data-deletion`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];
}

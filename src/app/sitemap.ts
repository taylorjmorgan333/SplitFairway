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
    { url: `${ORIGIN}/how-it-works`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${ORIGIN}/about`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${ORIGIN}/guides/golf-side-games`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${ORIGIN}/guides/golf-trip-expenses`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${ORIGIN}/tools/nassau-calculator`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${ORIGIN}/tools/skins-calculator`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${ORIGIN}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${ORIGIN}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${ORIGIN}/trip-mode`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
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

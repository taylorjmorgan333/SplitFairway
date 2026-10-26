import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";

const REQUIRED_PATHS = [
  "/",
  "/about",
  "/how-it-works",
  "/guides/golf-side-games",
  "/guides/golf-trip-expenses",
  "/tools/nassau-calculator",
  "/tools/skins-calculator",
  "/faq",
  "/pricing",
  "/trip-mode",
  "/contact",
  "/legal/privacy",
  "/legal/terms",
  "/legal/data-deletion",
];

describe("sitemap", () => {
  it("lists the public marketing, guide, and tool pages", () => {
    const paths = sitemap().map((entry) => new URL(entry.url).pathname);
    for (const path of REQUIRED_PATHS) {
      expect(paths, path).toContain(path);
    }
  });
});

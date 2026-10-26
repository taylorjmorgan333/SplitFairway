import type { Metadata } from "next";

const OG_IMAGE = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: "SplitFairway — every round, every game, every trip.",
};

/**
 * Page-level Open Graph replaces the root layout's block entirely, so
 * every public page restates site name, type, and image here.
 */
export function publicMetadata(title: string, description: string, path: string): Metadata {
  const socialTitle = `${title} · SplitFairway`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      siteName: "SplitFairway",
      type: "website",
      title: socialTitle,
      description,
      url: path,
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: ["/og-image.png"],
    },
  };
}

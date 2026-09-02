import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // Identifies this app across reinstalls/start_url changes,
    // independent of the URL itself — kept stable once set.
    id: "/",
    name: "SplitFairway",
    short_name: "SplitFairway",
    description:
      "Split lodging, tee times, rental cars and every other golf trip expense.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    // Matches the forest-900 badge/status-bar color already used for
    // apple-icon.png and the root layout's viewport themeColor.
    theme_color: "#0F2117",
    // Matches the app shell's page background (cream-50) so the splash
    // screen Android shows while the app boots doesn't flash a mismatched
    // color before the UI paints.
    background_color: "#FDFBF6",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

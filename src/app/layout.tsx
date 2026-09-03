import type { Metadata, Viewport } from "next";
import { Libre_Caslon_Display } from "next/font/google";
import "./globals.css";
import { FeedbackButton } from "@/components/layout/feedback-button";
import { ServiceWorkerRegister } from "@/components/layout/service-worker-register";

// Wordmark-only display face (src/components/ui/logo.tsx) — a bold,
// wide-tracked all-caps serif, distinct from the app's regular
// system-font "serif" stack (tailwind.config.ts) used everywhere else
// (headings, the mobile scorecard's hole number, etc.). Self-hosted by
// Next at build time via next/font, so there's no runtime request to
// Google Fonts and no layout shift.
const libreCaslonDisplay = Libre_Caslon_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-wordmark",
  display: "swap",
});

const SITE_DESCRIPTION =
  "Split lodging, tee times, rental cars and every other golf trip expense. Everyone sees exactly what they owe and when it's due.";

export const metadata: Metadata = {
  // Canonical production origin — every relative canonical/OG/Twitter
  // image URL set on individual pages resolves against this. Deploy
  // previews and localhost still render fine; this only affects the
  // absolute URLs put into <link rel="canonical"> and social meta tags.
  metadataBase: new URL("https://www.splitfairwaygolf.com"),
  title: {
    default: "SplitFairway",
    template: "%s · SplitFairway",
  },
  description: SITE_DESCRIPTION,
  // Per-page metadata (homepage, contact, legal pages, ...) overrides
  // these with its own title/description/canonical; this is the
  // fallback so no page ever falls back to Next's own defaults.
  openGraph: {
    siteName: "SplitFairway",
    type: "website",
    title: "SplitFairway",
    description: SITE_DESCRIPTION,
    url: "/",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "SplitFairway — keep the trip together, split everything else.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SplitFairway",
    description: SITE_DESCRIPTION,
    images: ["/og-image.png"],
  },
  appleWebApp: {
    // Enables "Add to Home Screen" standalone mode on iOS and sets the
    // status-bar style; iOS ignores the manifest's display/theme_color, so
    // this is the iOS-specific equivalent of those fields.
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SplitFairway",
  },
};

export const viewport: Viewport = {
  // width=device-width + initial-scale=1 is the mobile-usability baseline;
  // we deliberately do NOT cap maximumScale or set userScalable=no, since
  // preventing pinch-zoom is an accessibility regression for low-vision
  // users, even though it would also mask the 16px-input-font work below.
  width: "device-width",
  initialScale: 1,
  themeColor: "#0F2117",
  // Lets the page draw under the iPhone notch/status bar and home
  // indicator so env(safe-area-inset-*) resolves to real values instead of
  // 0 — required for the safe-area padding used in app-shell.tsx.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={libreCaslonDisplay.variable}>
      <body className="font-sans">
        {children}
        <FeedbackButton />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

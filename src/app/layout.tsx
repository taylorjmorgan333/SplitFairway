import type { Metadata, Viewport } from "next";
import "./globals.css";
import { FeedbackButton } from "@/components/layout/feedback-button";

export const metadata: Metadata = {
  title: {
    default: "SplitFairway",
    template: "%s · SplitFairway",
  },
  description:
    "Split lodging, tee times, rental cars and every other golf trip expense. Everyone sees exactly what they owe and when it's due.",
};

export const viewport: Viewport = {
  // width=device-width + initial-scale=1 is the mobile-usability baseline;
  // we deliberately do NOT cap maximumScale or set userScalable=no, since
  // preventing pinch-zoom is an accessibility regression for low-vision
  // users, even though it would also mask the 16px-input-font work below.
  width: "device-width",
  initialScale: 1,
  themeColor: "#0F2117",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans">
        {children}
        <FeedbackButton />
      </body>
    </html>
  );
}

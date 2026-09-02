import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Golf Trip Treasurer",
    template: "%s · Golf Trip Treasurer",
  },
  description:
    "Split lodging, tee times, rental cars and every other golf trip expense. Everyone sees exactly what they owe and when it's due.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}

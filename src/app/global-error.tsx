"use client";

/**
 * The last-resort boundary — catches an error thrown by the root layout
 * itself, where even the normal error.tsx boundaries can't render
 * (they live inside the layout). Next.js requires this file to render
 * its own <html>/<body>; it deliberately doesn't import the app's
 * regular CSS/layout, since the failure might be in that layout.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "1.5rem",
          background: "#FDFBF6",
          color: "#292722",
        }}
      >
        <p style={{ fontSize: "1.25rem", fontWeight: 600 }}>SplitFairway hit a snag</p>
        <p style={{ marginTop: "0.5rem", maxWidth: "28rem", fontSize: "0.9rem", color: "#615C51" }}>
          Nothing was lost — please try reloading the page.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: "1.5rem",
            height: "2.75rem",
            padding: "0 1.25rem",
            borderRadius: "9999px",
            background: "#183020",
            color: "#FDFBF6",
            fontSize: "0.875rem",
            fontWeight: 500,
            border: "none",
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}

import type { CapacitorConfig } from "@capacitor/core";

// SplitFairway's iOS app is a thin native shell around the real,
// already-deployed web app — not a rewrite. Pointing `server.url` at the
// production domain means the wrapper always loads the live app (auth,
// server actions, middleware, everything) exactly as it works in a
// browser; there's nothing to keep in sync between "the app" and "the
// site" because they're the same code and the same deployment.
const config: CapacitorConfig = {
  appId: "com.splitfairway.app",
  appName: "SplitFairway",
  // Required by the Capacitor config schema even in remote-url mode;
  // unused since server.url below takes over what's actually loaded.
  webDir: "public",
  server: {
    url: "https://www.splitfairwaygolf.com",
    // The site is served over HTTPS in production, so cleartext (plain
    // HTTP) traffic is never needed and stays disabled.
    cleartext: false,
  },
  ios: {
    // Capacitor disables pinch-to-zoom by default: unless this is set,
    // CAPBridgeViewController installs itself as the WKWebView's
    // scrollView delegate purely to implement
    // `scrollViewWillBeginZooming` -> `pinchGestureRecognizer.isEnabled
    // = false`, cancelling every pinch gesture the instant it starts.
    // That's true of every Capacitor app, not just this one -- it was
    // just never noticed here until the separate iPhone 17 Pro Max
    // zoom-scale bug (see MainViewController.swift) got fixed enough to
    // even try pinching. Setting this to true skips assigning that
    // delegate at all, so WKWebView falls back to its normal (Safari-
    // like) pinch behavior.
    zoomEnabled: true,
    // Matches the forest-900 brand color already used for the manifest
    // theme_color and the launch screen background, so there's no flash
    // of a mismatched color between the native launch screen and the
    // page painting in.
    backgroundColor: "#0F2117",
    // "never" (Capacitor's own default) -- the web app already handles
    // every safe-area inset itself via env(safe-area-inset-*) (see
    // .safe-top/.safe-bottom/.safe-x in globals.css and the
    // viewportFit: "cover" comment in layout.tsx). Leaving this on
    // "always" made the native WKWebView ALSO auto-inset its scroll
    // view for the notch/home indicator on top of that -- double
    // padding that pushed the whole layout down and cut content off
    // the bottom of the screen in the native app specifically (the
    // same pages render correctly in Mobile Safari, which never
    // applied that extra native inset).
    contentInset: "never",
  },
};

export default config;

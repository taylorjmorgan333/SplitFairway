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
    // Matches the forest-900 brand color already used for the manifest
    // theme_color and the launch screen background, so there's no flash
    // of a mismatched color between the native launch screen and the
    // page painting in.
    backgroundColor: "#0F2117",
    contentInset: "always",
  },
};

export default config;

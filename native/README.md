# SplitFairway — iOS App Store wrapper

This turns the live web app at https://www.splitfairwaygolf.com into a
real iOS app you can submit to the App Store. It is a thin native shell
(via [Capacitor](https://capacitorjs.com/)) that loads the production
site — there is no separate codebase to maintain. Any change deployed to
the site shows up in the app automatically; you only touch this native
project for things like the app icon, launch screen, or app-only
settings.

This whole setup has to run in a real Terminal on your Mac (not through
Claude) because it needs Xcode, which only exists there.

## Prerequisites

1. **Apple Developer Program membership** ($99/year) — enroll at
   https://developer.apple.com/programs/enroll/. Claude is walking you
   through this separately; nothing below works until it's approved.
2. **Xcode**, free from the Mac App Store. Open it once after installing
   so it finishes its own setup and installs the Command Line Tools.

## 1. Install the new dependencies

```
cd ~/Documents/golf-trip-treasurer
npm install
```

This pulls in `@capacitor/core`, `@capacitor/ios`, and `@capacitor/cli`,
which are already listed in `package.json`.

## 2. Generate the iOS project

```
npx cap add ios
```

This creates an `ios/` folder containing a real Xcode project
(`ios/App/App.xcworkspace`). It reads `capacitor.config.ts`, which
already points the app at the live SplitFairway site and sets the
brand background color.

## 3. Add the app icon and launch screen

The icon and a launch-screen image (both generated from the same
approved SplitFairway crest artwork already used everywhere else in the
app — nothing was redrawn) are sitting in `native/ios-assets/`:

- `AppIcon-1024.png` — the single 1024×1024 App Store icon. In Xcode:
  open `ios/App/App/Assets.xcassets`, click `AppIcon`, and drag this
  file onto the "App Store iOS 1024pt" slot. Xcode generates every
  smaller size from it automatically.
- `splash-2732.png` / `splash-dark-2732.png` — the launch screen image.
  Open `ios/App/App/Assets.xcassets`, click `Splash`, and drag these
  onto the universal and dark-mode slots.

## 4. Open the project and set up signing

```
npm run ios:open
```

This runs `cap sync` (copies the web config into the native project)
and opens Xcode. In Xcode:

1. Click the top-level "App" project in the left sidebar, then the
   "App" target, then the "Signing & Capabilities" tab.
2. Check "Automatically manage signing."
3. Under "Team," pick your Apple Developer account (it appears here
   once you're signed into Xcode with the same Apple ID you enrolled
   with — Xcode → Settings → Accounts to add it if it's not there yet).
4. Confirm the Bundle Identifier reads `com.splitfairway.app`.

## 5. Run it

Pick an iPhone Simulator from the device dropdown at the top of Xcode
and press the ▶ Run button. The app should launch full-screen, no
browser address bar, and load the real SplitFairway site.

## 6. When you're ready to submit

Xcode → Product → Archive, then use the Organizer window's "Distribute
App" button to upload the build to App Store Connect. Claude can walk
through the App Store Connect listing (screenshots, description,
privacy details) once a build is uploaded — that part happens in the
browser at https://appstoreconnect.apple.com, the same
screenshot-and-copy-paste way we set up Vercel and GoDaddy.

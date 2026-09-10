import Capacitor
import Foundation
import WebKit

// iPhone 17 Pro Max (and possibly other very new screen sizes) has been
// observed loading the app's WKWebView at an incorrect initial zoom scale
// of roughly 1.14x (exactly 8/7) instead of the 1.0 the page's own
// `<meta name="viewport" content="...initial-scale=1...">` declares --
// confirmed via window.visualViewport.scale in Safari's Web Inspector.
// WebKit was also observed re-imposing that same wrong scale repeatedly
// on nearly every layout pass, not just once at load, and its internal
// min/max zoom range appeared to collapse toward 1.0 alongside it --
// leaving no range for a pinch gesture to zoom into even with
// ignoresViewportScaleLimits enabled (which only overrides limits the
// *page* itself declares, not WebKit's own derived range).
//
// This forces a real, fixed zoom range on the scrollView (1.0-5.0) and
// corrects the zoom scale back to 1.0 for the lifetime of the app,
// re-applying both on every load/layout change since WebKit keeps
// resetting them on its own. It backs off permanently the moment a
// genuine user pinch/decelerate gesture is detected, so it can never
// fight a deliberate zoom.
class MainViewController: CAPBridgeViewController {
    private var isLoadingObservation: NSKeyValueObservation?
    private var contentSizeObservation: NSKeyValueObservation?
    private var zoomScaleObservation: NSKeyValueObservation?
    private var hasUserManuallyZoomed = false

    private let minZoom: CGFloat = 1.0
    private let maxZoom: CGFloat = 5.0

    // Must match SessionCookieStorePlugin's key below exactly -- kept
    // as a plain literal in both places (rather than a shared static)
    // since they're separate top-level types in this file.
    private static let sessionCookiesKey = "sf.sessionCookiesJSON"
    private static let cookieDomain = "www.splitfairwaygolf.com"

    // Appended to WKWebView's default user agent (not a replacement --
    // this only adds a token at the end) so the server can tell a
    // request came from this native app apart from a normal browser,
    // straight from the request itself. Used by src/app/(auth)/login/
    // page.tsx to decide whether to render the login form at all in
    // the initial HTML -- see that file for why.
    private static let userAgentToken = "SplitFairwayApp"

    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let configuration = super.webViewConfiguration(for: instanceConfiguration)
        configuration.ignoresViewportScaleLimits = true
        configuration.applicationNameForUserAgent = MainViewController.userAgentToken
        restoreSessionCookies(into: configuration.websiteDataStore.httpCookieStore)
        return configuration
    }

    /// Re-seeds the WKWebView's cookie jar with whatever Supabase auth
    /// cookies were last snapshotted to UserDefaults (see
    /// SessionCookieStorePlugin.save below, called from the web app's
    /// JS side -- src/lib/native-session-sync.ts) *before* the webview
    /// issues its first request to server.url.
    ///
    /// WKWebView is documented to sometimes drop even long-lived,
    /// non-expired first-party cookies specifically around a full
    /// force-quit/relaunch cycle (confirmed happening on this app: four
    /// forced re-logins in 40 minutes, all with a valid ~400-day
    /// session cookie already set). When that happens, the server sees
    /// no session cookie at all on this very first request and
    /// redirects straight to /login -- too late for any client-side JS
    /// restore to undo, since the redirect already happened server-side
    /// before any page script runs. So this has to happen here,
    /// natively, before that first request goes out.
    ///
    /// Must return before Capacitor creates the webview and starts
    /// loading it -- there's no later, safe hook to inject cookies into
    /// a configuration that's already in use. The setCookie calls below
    /// are issued synchronously but NOT waited on: their completion
    /// handler fires back on the main thread (per Apple's docs), and
    /// this method already runs on the main thread (Capacitor calls
    /// webViewConfiguration(for:) during UI setup), so blocking here
    /// for that same completion would be a guaranteed self-deadlock --
    /// confirmed on a real device before this was corrected.
    private func restoreSessionCookies(into cookieStore: WKHTTPCookieStore) {
        guard let json = UserDefaults.standard.string(forKey: MainViewController.sessionCookiesKey),
              let data = json.data(using: .utf8),
              let entries = (try? JSONSerialization.jsonObject(with: data)) as? [[String: String]],
              !entries.isEmpty else {
            return
        }

        // We only ever captured name/value pairs (document.cookie never
        // exposes a cookie's real expiry to JS), so there's no original
        // lifetime to restore -- this just gives the cookie a fresh,
        // generous one. The actual source of truth for whether the
        // session is still valid is the refresh token itself, verified
        // server-side on the next request; an overly generous client-
        // side expiry here doesn't change what that check can do.
        let farFuture = Date().addingTimeInterval(400 * 24 * 60 * 60)

        for entry in entries {
            guard let name = entry["name"], let value = entry["value"],
                  let cookie = HTTPCookie(properties: [
                    .name: name,
                    .value: value,
                    .domain: MainViewController.cookieDomain,
                    .path: "/",
                    .expires: farFuture,
                    .sameSitePolicy: "Lax",
                  ]) else {
                continue
            }
            cookieStore.setCookie(cookie)
        }
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()

        // Capacitor does NOT auto-discover local (non-npm-package)
        // plugins just by conforming to CAPBridgedPlugin -- confirmed
        // the hard way (JS calls failed with "plugin is not
        // implemented on ios" until this was added). Manual
        // registration is the documented, required step for a plugin
        // that lives directly in the app target instead of its own
        // package: https://capacitorjs.com/docs/ios/custom-code
        bridge?.registerPluginInstance(SessionCookieStorePlugin())

        guard let webView = self.webView else { return }

        applyZoomRange(to: webView.scrollView)

        isLoadingObservation = webView.observe(\.isLoading, options: [.new]) { [weak self, weak webView] _, change in
            guard change.newValue == false, let webView = webView else { return }
            self?.correctZoom(on: webView)
        }

        contentSizeObservation = webView.scrollView.observe(\.contentSize, options: [.new]) { [weak self, weak webView] _, _ in
            guard let webView = webView else { return }
            self?.correctZoom(on: webView)
        }

        zoomScaleObservation = webView.scrollView.observe(\.zoomScale, options: []) { [weak self] scrollView, _ in
            if scrollView.isZooming || scrollView.isDecelerating {
                self?.hasUserManuallyZoomed = true
            }
        }
    }

    /// Forces a real, non-degenerate zoom range on the scrollView. WebKit
    /// recomputes its own idea of this range during layout on this device
    /// (alongside the zoomScale bug above), so this is re-applied every
    /// time we touch the scrollView, not just once at load.
    private func applyZoomRange(to scrollView: UIScrollView) {
        if scrollView.minimumZoomScale != minZoom || scrollView.maximumZoomScale != maxZoom {
            scrollView.minimumZoomScale = minZoom
            scrollView.maximumZoomScale = maxZoom
        }
        scrollView.pinchGestureRecognizer?.isEnabled = true
    }

    private func correctZoom(on webView: WKWebView) {
        guard !hasUserManuallyZoomed else { return }
        let scrollView = webView.scrollView
        guard !scrollView.isDragging, !scrollView.isDecelerating, !scrollView.isZooming else { return }

        applyZoomRange(to: scrollView)

        guard abs(scrollView.zoomScale - 1.0) > 0.001 else { return }
        DispatchQueue.main.async {
            scrollView.setZoomScale(1.0, animated: false)
        }
    }
}

/// JS-callable bridge (see src/lib/native-session-sync.ts) that lets the
/// web app snapshot its current Supabase auth cookies into UserDefaults,
/// so MainViewController can re-seed the WKWebView's cookie jar with
/// them on the next cold launch -- see restoreSessionCookies(into:)
/// above for why that's needed. Declared in this file (rather than its
/// own) so adding it doesn't require a new Xcode project file reference
/// -- this file is already part of the build target.
@objc(SessionCookieStorePlugin)
public class SessionCookieStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SessionCookieStorePlugin"
    public let jsName = "SessionCookieStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "save", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
    ]

    // Must match MainViewController's equivalents above exactly.
    private static let sessionCookiesKey = "sf.sessionCookiesJSON"
    private static let cookieDomain = "www.splitfairwaygolf.com"

    @objc func save(_ call: CAPPluginCall) {
        guard let json = call.getString("json"), !json.isEmpty else {
            call.resolve()
            return
        }
        UserDefaults.standard.set(json, forKey: SessionCookieStorePlugin.sessionCookiesKey)
        call.resolve()
    }

    @objc func clear(_ call: CAPPluginCall) {
        UserDefaults.standard.removeObject(forKey: SessionCookieStorePlugin.sessionCookiesKey)
        call.resolve()
    }

    /// JS-callable fallback restore, called from the /login page itself
    /// (see src/components/auth/native-session-recovery.tsx) when the
    /// app lands there despite having a saved session -- meaning the
    /// best-effort injection in MainViewController.webViewConfiguration
    /// lost its race against the very first request going out (that
    /// injection can't be blocked on without deadlocking the main
    /// thread, so it isn't always guaranteed to win). By the time a
    /// page has actually loaded and run this plugin call, there's no
    /// synchronous-return constraint anymore, so this can safely wait
    /// for every setCookie completion (via group.notify, still non-
    /// blocking) before resolving -- the caller then does a real
    /// reload, which is what actually gets the newly-set cookie sent
    /// to the server.
    @objc func restore(_ call: CAPPluginCall) {
        guard let webView = self.bridge?.webView else {
            call.resolve(["restored": false])
            return
        }
        guard let json = UserDefaults.standard.string(forKey: SessionCookieStorePlugin.sessionCookiesKey),
              let data = json.data(using: .utf8),
              let entries = (try? JSONSerialization.jsonObject(with: data)) as? [[String: String]],
              !entries.isEmpty else {
            call.resolve(["restored": false])
            return
        }

        let cookieStore = webView.configuration.websiteDataStore.httpCookieStore
        let farFuture = Date().addingTimeInterval(400 * 24 * 60 * 60)
        let group = DispatchGroup()
        var injectedAny = false

        for entry in entries {
            guard let name = entry["name"], let value = entry["value"],
                  let cookie = HTTPCookie(properties: [
                    .name: name,
                    .value: value,
                    .domain: SessionCookieStorePlugin.cookieDomain,
                    .path: "/",
                    .expires: farFuture,
                    .sameSitePolicy: "Lax",
                  ]) else {
                continue
            }
            injectedAny = true
            group.enter()
            cookieStore.setCookie(cookie) { group.leave() }
        }

        guard injectedAny else {
            call.resolve(["restored": false])
            return
        }
        group.notify(queue: .main) {
            call.resolve(["restored": true])
        }
    }
}

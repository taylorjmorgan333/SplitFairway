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

    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        NSLog("[SessionCookieStore] webViewConfiguration(for:) called")
        let configuration = super.webViewConfiguration(for: instanceConfiguration)
        configuration.ignoresViewportScaleLimits = true
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
    /// Runs synchronously (bounded by a 1s timeout) because this method
    /// must return a fully-configured WKWebViewConfiguration before
    /// Capacitor creates the webview and starts loading it -- there's
    /// no later, safe hook to inject cookies into a configuration
    /// that's already in use.
    private func restoreSessionCookies(into cookieStore: WKHTTPCookieStore) {
        NSLog("[SessionCookieStore] restoreSessionCookies called")

        guard let json = UserDefaults.standard.string(forKey: MainViewController.sessionCookiesKey) else {
            NSLog("[SessionCookieStore] no saved snapshot found in UserDefaults for key %@", MainViewController.sessionCookiesKey)
            return
        }
        NSLog("[SessionCookieStore] found saved snapshot, %d chars", json.count)

        guard let data = json.data(using: .utf8),
              let entries = (try? JSONSerialization.jsonObject(with: data)) as? [[String: String]],
              !entries.isEmpty else {
            NSLog("[SessionCookieStore] snapshot failed to parse as [[String: String]]")
            return
        }
        NSLog("[SessionCookieStore] parsed %d entrie(s) to restore", entries.count)

        // We only ever captured name/value pairs (document.cookie never
        // exposes a cookie's real expiry to JS), so there's no original
        // lifetime to restore -- this just gives the cookie a fresh,
        // generous one. The actual source of truth for whether the
        // session is still valid is the refresh token itself, verified
        // server-side on the next request; an overly generous client-
        // side expiry here doesn't change what that check can do.
        let farFuture = Date().addingTimeInterval(400 * 24 * 60 * 60)
        let group = DispatchGroup()

        for entry in entries {
            guard let name = entry["name"], let value = entry["value"] else {
                NSLog("[SessionCookieStore] entry missing name/value, skipping: %@", entry)
                continue
            }
            guard let cookie = HTTPCookie(properties: [
                    .name: name,
                    .value: value,
                    .domain: MainViewController.cookieDomain,
                    .path: "/",
                    .expires: farFuture,
                    .sameSitePolicy: "Lax",
                  ]) else {
                NSLog("[SessionCookieStore] HTTPCookie(properties:) returned nil for cookie named %@", name)
                continue
            }
            NSLog("[SessionCookieStore] injecting cookie %@ (domain=%@, %d chars)", name, MainViewController.cookieDomain, value.count)
            group.enter()
            cookieStore.setCookie(cookie) {
                NSLog("[SessionCookieStore] setCookie completion fired for %@", name)
                group.leave()
            }
        }

        let waitResult = group.wait(timeout: .now() + 1.0)
        NSLog("[SessionCookieStore] restore wait finished, result=%@", waitResult == .success ? "success" : "timedOut")
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()

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
        CAPPluginMethod(name: "log", returnType: CAPPluginReturnPromise),
    ]

    // Must match MainViewController.sessionCookiesKey above exactly.
    private static let sessionCookiesKey = "sf.sessionCookiesJSON"

    @objc func save(_ call: CAPPluginCall) {
        guard let json = call.getString("json"), !json.isEmpty else {
            NSLog("[SessionCookieStore] save() called with empty/missing json -- ignoring")
            call.resolve()
            return
        }
        NSLog("[SessionCookieStore] save() called, %d chars", json.count)
        UserDefaults.standard.set(json, forKey: SessionCookieStorePlugin.sessionCookiesKey)
        call.resolve()
    }

    @objc func clear(_ call: CAPPluginCall) {
        NSLog("[SessionCookieStore] clear() called")
        UserDefaults.standard.removeObject(forKey: SessionCookieStorePlugin.sessionCookiesKey)
        call.resolve()
    }

    // TEMPORARY: lets the JS side (src/lib/native-session-sync.ts) route
    // its own diagnostic messages into NSLog/Xcode's console, so a real
    // device test shows the whole JS + native chain in one place. Remove
    // this method (and the JS-side `diag()` helper that calls it) once
    // the force-quit restore is confirmed working.
    @objc func log(_ call: CAPPluginCall) {
        NSLog("[SessionCookieStore][JS] %@", call.getString("message") ?? "(no message)")
        call.resolve()
    }
}

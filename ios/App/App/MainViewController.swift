import Capacitor
import Foundation
import UIKit
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

    // TEMPORARY: shows the restore diagnostic as an on-screen popup
    // instead of relying on Xcode's console or Console.app -- both
    // have proven unreliable for observing a genuine force-quit +
    // manual relaunch cycle (Xcode's console detaches from a process
    // it didn't itself launch/attach to; Console.app requires
    // "Start streaming" to be clicked *before* the relaunch happens,
    // which is easy to miss). Remove this block, showRestoreDiagnosticIfNeeded,
    // viewDidAppear, and the diagnostic-string-building below once the
    // force-quit restore is confirmed working.
    private var restoreDiagnostic = "restoreSessionCookies never ran"
    private var hasShownRestoreDiagnostic = false

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
            restoreDiagnostic = "No saved snapshot found in UserDefaults.\n\nThis means either save() never ran (not signed in with \"Stay signed in\" checked yet), or something cleared it."
            return
        }
        NSLog("[SessionCookieStore] found saved snapshot, %d chars", json.count)

        guard let data = json.data(using: .utf8),
              let entries = (try? JSONSerialization.jsonObject(with: data)) as? [[String: String]],
              !entries.isEmpty else {
            NSLog("[SessionCookieStore] snapshot failed to parse as [[String: String]]")
            restoreDiagnostic = "Found a snapshot (\(json.count) chars) but failed to parse it as cookie entries."
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
        var injectedNames: [String] = []
        var failedNames: [String] = []

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
                failedNames.append(name)
                continue
            }
            NSLog("[SessionCookieStore] injecting cookie %@ (domain=%@, %d chars)", name, MainViewController.cookieDomain, value.count)
            group.enter()
            cookieStore.setCookie(cookie) {
                NSLog("[SessionCookieStore] setCookie completion fired for %@", name)
                group.leave()
            }
            injectedNames.append(name)
        }

        // NOT blocking here on purpose. setCookie's completion handler
        // fires back on the main thread (per Apple's docs), and this
        // whole method already runs on the main thread (Capacitor calls
        // webViewConfiguration(for:) during UI setup) -- a synchronous
        // group.wait() here would block the very thread the completion
        // needs in order to fire, i.e. a guaranteed self-deadlock. That
        // was confirmed on-device: every real test reported "timed
        // out", which is consistent with this always happening
        // regardless of whether the cookie injection itself worked.
        // Logging the actual completion asynchronously instead -- still
        // useful in Xcode's console if it happens to be attached, just
        // not something we block on.
        group.notify(queue: .main) {
            NSLog("[SessionCookieStore] all setCookie completions fired")
        }

        restoreDiagnostic = [
            "Snapshot found: \(json.count) chars, \(entries.count) entrie(s) parsed.",
            "Requested injection of: \(injectedNames.isEmpty ? "(none)" : injectedNames.joined(separator: ", "))",
            failedNames.isEmpty ? nil : "Failed to build cookie for: \(failedNames.joined(separator: ", "))",
        ].compactMap { $0 }.joined(separator: "\n")
    }

    /// TEMPORARY: shows restoreDiagnostic as an alert once the view is
    /// actually on screen (webViewConfiguration(for:) runs too early
    /// to safely present anything). Guarded to only show once per
    /// launch so it doesn't reappear on every foreground/background.
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard !hasShownRestoreDiagnostic else { return }
        hasShownRestoreDiagnostic = true

        let alert = UIAlertController(
            title: "Session restore diagnostic",
            message: restoreDiagnostic,
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
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
        NSLog("[SessionCookieStore] registerPluginInstance(SessionCookieStorePlugin()) called")

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

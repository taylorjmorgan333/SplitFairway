import Capacitor
import WebKit

// iPhone 17 Pro Max (and possibly other very new screen sizes) has been
// observed loading the app's WKWebView at an incorrect initial zoom scale
// of roughly 1.14x instead of the 1.0 the page's own
// `<meta name="viewport" content="...initial-scale=1...">` declares --
// confirmed via window.visualViewport.scale in Safari's Web Inspector.
//
// NSLog diagnostics (kept from the previous debugging round) showed the
// zoomScale was already correct (1.0) on the marketing homepage the
// whole time -- the bug only shows up after navigating further into the
// app (e.g. Dashboard after signing in). The previous version's 5-second
// "correction window" was measured from the very first page load at app
// launch, not from each subsequent page, so by the time someone actually
// reaches the Dashboard that window has long since closed and the fix
// silently stops trying. This version removes that fixed window
// entirely and keeps correcting for the lifetime of the app, only
// backing off permanently once the person performs a real pinch gesture
// themselves (detected via isZooming/isDecelerating at the moment the
// scale changes), so the fix can never fight a deliberate zoom.
class MainViewController: CAPBridgeViewController {
    private var isLoadingObservation: NSKeyValueObservation?
    private var contentSizeObservation: NSKeyValueObservation?
    private var zoomScaleObservation: NSKeyValueObservation?
    private var hasUserManuallyZoomed = false

    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let configuration = super.webViewConfiguration(for: instanceConfiguration)
        configuration.ignoresViewportScaleLimits = true
        return configuration
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        NSLog("[ZoomFix] capacitorDidLoad called, webView present: \(self.webView != nil)")

        guard let webView = self.webView else { return }

        isLoadingObservation = webView.observe(\.isLoading, options: [.new]) { [weak self, weak webView] _, change in
            guard change.newValue == false, let webView = webView else { return }
            self?.correctZoom(on: webView, source: "isLoading")
        }

        contentSizeObservation = webView.scrollView.observe(\.contentSize, options: [.new]) { [weak self, weak webView] _, change in
            guard let webView = webView else { return }
            self?.correctZoom(on: webView, source: "contentSize=\(String(describing: change.newValue))")
        }

        zoomScaleObservation = webView.scrollView.observe(\.zoomScale, options: []) { [weak self] scrollView, _ in
            if scrollView.isZooming || scrollView.isDecelerating {
                NSLog("[ZoomFix] user is manually zooming -- disabling auto-correction from now on")
                self?.hasUserManuallyZoomed = true
            }
        }
    }

    private func correctZoom(on webView: WKWebView, source: String) {
        guard !hasUserManuallyZoomed else { return }
        let scrollView = webView.scrollView
        guard !scrollView.isDragging, !scrollView.isDecelerating, !scrollView.isZooming else { return }
        guard abs(scrollView.zoomScale - 1.0) > 0.001 else { return }
        NSLog("[ZoomFix] (\(source)) correcting zoomScale \(scrollView.zoomScale) -> 1.0")
        DispatchQueue.main.async {
            scrollView.setZoomScale(1.0, animated: false)
        }
    }
}

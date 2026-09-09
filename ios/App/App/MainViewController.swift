import Capacitor
import WebKit

// iPhone 17 Pro Max (and possibly other very new screen sizes) has been
// observed loading the app's WKWebView at an incorrect initial zoom scale
// of roughly 1.14x instead of the 1.0 the page's own
// `<meta name="viewport" content="...initial-scale=1...">` declares --
// confirmed via window.visualViewport.scale in Safari's Web Inspector,
// and separately confirmed by hand: double-tapping the screen forces
// WebKit to recompute its zoom and snaps straight to the correct layout,
// even several seconds after the app opens. That timing is the key
// clue: a single correction right after the network load finishes
// (WKWebView's isLoading flag) wasn't enough, and neither was retrying a
// few times over the following second -- something keeps re-deriving
// the wrong scale well after that, most likely each time the page's own
// rendered content changes size (web fonts swapping in, React/Next.js
// hydration, images loading).
//
// Two things work together here, having been tried separately without
// success:
//
// 1. ignoresViewportScaleLimits -- without this, WKWebView (unlike
//    Mobile Safari, which sets it internally) clamps pinch-zoom to
//    whatever min/max-scale the page's viewport meta tag implies, which
//    is effectively locked at 1.0 here since only initial-scale=1 is
//    declared. This alone was tried and reverted previously because,
//    without any post-load correction, it made the wrong-initial-scale
//    layout bug worse.
// 2. Instead of correcting on a fixed timer, this observes the
//    webview's own scrollView.contentSize -- which changes every time
//    the page's rendered layout actually changes -- and re-applies the
//    zoomScale=1.0 correction each time, for several seconds after
//    load. That ties the fix directly to the event that keeps causing
//    the problem, rather than guessing how long settling takes.
class MainViewController: CAPBridgeViewController {
    private var isLoadingObservation: NSKeyValueObservation?
    private var contentSizeObservation: NSKeyValueObservation?
    private var correctionDeadline: Date?

    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let configuration = super.webViewConfiguration(for: instanceConfiguration)
        configuration.ignoresViewportScaleLimits = true
        return configuration
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()

        guard let webView = self.webView else { return }

        // Generous window: web fonts, hydration and images can keep
        // reshaping the page for a few seconds after the network load
        // itself finishes, each potentially re-triggering WebKit's own
        // (incorrect) zoom computation.
        correctionDeadline = Date().addingTimeInterval(5.0)

        isLoadingObservation = webView.observe(\.isLoading, options: [.new]) { [weak self, weak webView] _, change in
            guard change.newValue == false, let webView = webView else { return }
            self?.correctZoom(on: webView)
        }

        contentSizeObservation = webView.scrollView.observe(\.contentSize, options: [.new]) { [weak self, weak webView] _, _ in
            guard let webView = webView else { return }
            self?.correctZoom(on: webView)
        }
    }

    private func correctZoom(on webView: WKWebView) {
        guard let deadline = correctionDeadline, Date() < deadline else { return }
        let scrollView = webView.scrollView
        // Never fight a zoom the person is actively performing themselves.
        guard !scrollView.isDragging, !scrollView.isDecelerating, !scrollView.isZooming else { return }
        guard abs(scrollView.zoomScale - 1.0) > 0.001 else { return }
        DispatchQueue.main.async {
            scrollView.setZoomScale(1.0, animated: false)
        }
    }
}

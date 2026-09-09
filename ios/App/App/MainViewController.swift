import Capacitor
import WebKit

// iPhone 17 Pro Max (and possibly other very new screen sizes) has been
// observed loading the app's WKWebView at an incorrect initial zoom scale
// of roughly 1.14x (exactly 8/7) instead of the 1.0 the page's own
// `<meta name="viewport" content="...initial-scale=1...">` declares --
// confirmed via window.visualViewport.scale in Safari's Web Inspector.
// The layout-cutoff half of this bug is fixed by correctZoom() below,
// confirmed working on-device.
//
// Pinch-to-zoom, however, still didn't work even with that fix in place.
// NSLog diagnostics captured on the Dashboard showed correctZoom() firing
// repeatedly with the SAME wrong zoomScale (1.143181818181818) on nearly
// every layout pass -- meaning WebKit keeps recomputing and re-imposing
// that incorrect scale on its own, over and over, not just once at load.
// That points to WebKit's internal min/max zoom range also being
// miscalculated alongside the initial scale on this device: even with
// ignoresViewportScaleLimits enabled (which only overrides limits the
// *page* declares), if WebKit's own derived minimumZoomScale and
// maximumZoomScale collapse down near 1.0, there is no range left for a
// pinch gesture to zoom into, regardless of how hard someone pinches.
//
// This version explicitly forces a real, fixed zoom range on the
// scrollView (1.0-5.0) every time it's touched, instead of trusting
// WebKit's own (buggy, on this device) calculation of that range.
class MainViewController: CAPBridgeViewController {
    private var isLoadingObservation: NSKeyValueObservation?
    private var contentSizeObservation: NSKeyValueObservation?
    private var zoomScaleObservation: NSKeyValueObservation?
    private var hasUserManuallyZoomed = false

    private let minZoom: CGFloat = 1.0
    private let maxZoom: CGFloat = 5.0

    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let configuration = super.webViewConfiguration(for: instanceConfiguration)
        configuration.ignoresViewportScaleLimits = true
        return configuration
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        NSLog("[ZoomFix] capacitorDidLoad called, webView present: \(self.webView != nil)")

        guard let webView = self.webView else { return }

        applyZoomRange(to: webView.scrollView, source: "capacitorDidLoad")

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

    /// Forces a real, non-degenerate zoom range on the scrollView. WebKit
    /// recomputes its own idea of this range during layout on this device
    /// (alongside the zoomScale bug above), so this is re-applied every
    /// time we touch the scrollView, not just once at load.
    private func applyZoomRange(to scrollView: UIScrollView, source: String) {
        if scrollView.minimumZoomScale != minZoom || scrollView.maximumZoomScale != maxZoom {
            NSLog("[ZoomFix] (\(source)) fixing zoom range \(scrollView.minimumZoomScale)-\(scrollView.maximumZoomScale) -> \(minZoom)-\(maxZoom)")
            scrollView.minimumZoomScale = minZoom
            scrollView.maximumZoomScale = maxZoom
        }
        scrollView.pinchGestureRecognizer?.isEnabled = true
    }

    private func correctZoom(on webView: WKWebView, source: String) {
        guard !hasUserManuallyZoomed else { return }
        let scrollView = webView.scrollView
        guard !scrollView.isDragging, !scrollView.isDecelerating, !scrollView.isZooming else { return }

        applyZoomRange(to: scrollView, source: source)

        guard abs(scrollView.zoomScale - 1.0) > 0.001 else { return }
        NSLog("[ZoomFix] (\(source)) correcting zoomScale \(scrollView.zoomScale) -> 1.0")
        DispatchQueue.main.async {
            scrollView.setZoomScale(1.0, animated: false)
        }
    }
}

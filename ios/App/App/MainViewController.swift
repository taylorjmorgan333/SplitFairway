import Capacitor
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

    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let configuration = super.webViewConfiguration(for: instanceConfiguration)
        configuration.ignoresViewportScaleLimits = true
        return configuration
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

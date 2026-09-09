import Capacitor
import WebKit

// iPhone 17 Pro Max (and possibly other very new screen sizes) has been
// observed loading the app's WKWebView at an incorrect initial zoom scale
// of roughly 1.14x instead of the 1.0 the page's own
// `<meta name="viewport" content="...initial-scale=1...">` declares --
// confirmed via window.visualViewport.scale in Safari's Web Inspector,
// and separately confirmed by hand: double-tapping the screen forces
// WebKit to recompute its zoom and snaps straight to the correct layout,
// even several seconds after the app opens.
//
// Two rounds of automatic correction (a fixed-delay retry, then tying it
// to scrollView.contentSize changes) have not reproduced what a manual
// double-tap does, so this version adds NSLog diagnostics at every step
// -- did the class load at all, did the KVO observers fire, what scale
// values were actually seen -- visible in Xcode's console while running
// from Xcode, to find out WHERE this stops working rather than guessing
// again blind.
class MainViewController: CAPBridgeViewController {
    private var isLoadingObservation: NSKeyValueObservation?
    private var contentSizeObservation: NSKeyValueObservation?
    private var correctionDeadline: Date?

    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        NSLog("[ZoomFix] webViewConfiguration called")
        let configuration = super.webViewConfiguration(for: instanceConfiguration)
        configuration.ignoresViewportScaleLimits = true
        return configuration
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        NSLog("[ZoomFix] capacitorDidLoad called, webView present: \(self.webView != nil)")

        guard let webView = self.webView else { return }

        correctionDeadline = Date().addingTimeInterval(5.0)

        isLoadingObservation = webView.observe(\.isLoading, options: [.new]) { [weak self, weak webView] _, change in
            NSLog("[ZoomFix] isLoading changed to \(String(describing: change.newValue))")
            guard change.newValue == false, let webView = webView else { return }
            self?.correctZoom(on: webView, source: "isLoading")
        }

        contentSizeObservation = webView.scrollView.observe(\.contentSize, options: [.new]) { [weak self, weak webView] _, change in
            NSLog("[ZoomFix] contentSize changed to \(String(describing: change.newValue))")
            guard let webView = webView else { return }
            self?.correctZoom(on: webView, source: "contentSize")
        }
    }

    private func correctZoom(on webView: WKWebView, source: String) {
        let scrollView = webView.scrollView
        NSLog("[ZoomFix] correctZoom(\(source)) checking -- zoomScale=\(scrollView.zoomScale) dragging=\(scrollView.isDragging) decelerating=\(scrollView.isDecelerating) zooming=\(scrollView.isZooming) deadlinePassed=\(!(correctionDeadline.map { Date() < $0 } ?? false))")

        guard let deadline = correctionDeadline, Date() < deadline else {
            NSLog("[ZoomFix] skipped -- past correction deadline")
            return
        }
        guard !scrollView.isDragging, !scrollView.isDecelerating, !scrollView.isZooming else {
            NSLog("[ZoomFix] skipped -- user is interacting")
            return
        }
        guard abs(scrollView.zoomScale - 1.0) > 0.001 else {
            NSLog("[ZoomFix] skipped -- zoomScale already ~1.0")
            return
        }
        NSLog("[ZoomFix] APPLYING correction: zoomScale \(scrollView.zoomScale) -> 1.0")
        DispatchQueue.main.async {
            scrollView.setZoomScale(1.0, animated: false)
            NSLog("[ZoomFix] after setZoomScale, actual zoomScale=\(scrollView.zoomScale)")
        }
    }
}

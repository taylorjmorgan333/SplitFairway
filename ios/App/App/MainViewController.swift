import Capacitor
import WebKit

// iPhone 17 Pro Max (and possibly other very new screen sizes) has been
// observed loading the app's WKWebView at an incorrect initial zoom scale
// of roughly 1.14x instead of the 1.0 the page's own
// `<meta name="viewport" content="...initial-scale=1...">` declares --
// confirmed directly via window.visualViewport.scale in Safari's Web
// Inspector while attached to the running app, and separately confirmed
// by hand: double-tapping the screen forces WebKit to recompute its zoom
// and snaps straight to the correct layout. That's strong evidence
// WebKit *can* compute the right scale here -- it just doesn't do so on
// its own on first load, and whatever it does shortly after our first
// correction attempt overwrites a single, immediate reset.
//
// Two things are needed together, having been tried separately before
// without success:
//
// 1. ignoresViewportScaleLimits -- without this, WKWebView (unlike
//    Mobile Safari, which sets it internally) clamps pinch-zoom to
//    whatever min/max-scale the page's viewport meta tag implies, which
//    is effectively locked at 1.0 here since only initial-scale=1 is
//    declared. This alone was tried and reverted previously because,
//    without any post-load correction, it made the wrong-initial-scale
//    layout bug worse.
// 2. Repeatedly resetting the webview's zoomScale back to 1.0 over the
//    first second after load (not just once), so the correction lands
//    after whatever later recalculation was silently undoing a single
//    immediate reset -- the same effect a manual double-tap has.
class MainViewController: CAPBridgeViewController {
    private var isLoadingObservation: NSKeyValueObservation?

    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let configuration = super.webViewConfiguration(for: instanceConfiguration)
        configuration.ignoresViewportScaleLimits = true
        return configuration
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()

        guard let webView = self.webView else { return }

        isLoadingObservation = webView.observe(\.isLoading, options: [.new]) { [weak self, weak webView] _, change in
            guard change.newValue == false, let webView = webView, self != nil else { return }
            MainViewController.correctInitialZoom(on: webView)
        }
    }

    private static func correctInitialZoom(on webView: WKWebView) {
        let delays: [Double] = [0.0, 0.15, 0.3, 0.6, 1.0]
        for delay in delays {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak webView] in
                guard let webView = webView else { return }
                let scrollView = webView.scrollView
                if abs(scrollView.zoomScale - 1.0) > 0.001 {
                    scrollView.setZoomScale(1.0, animated: false)
                }
            }
        }
    }
}

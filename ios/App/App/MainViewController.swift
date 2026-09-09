import Capacitor
import WebKit

// iPhone 17 Pro Max (and possibly other very new screen sizes) has been
// observed loading the app's WKWebView at an incorrect initial zoom scale
// of roughly 1.14x instead of the 1.0 the page's own
// `<meta name="viewport" content="...initial-scale=1...">` declares --
// confirmed directly via window.visualViewport.scale in Safari's Web
// Inspector while attached to the running app. This is not explained by
// anything in this project: the viewport tag is correct, the launch
// screen resizes properly, Xcode and the iOS deployment target are
// current, and the same Capacitor version renders correctly in every
// other respect. It matches open, unresolved Capacitor issues specific to
// the iPhone 17 generation's new screen geometry (e.g.
// ionic-team/capacitor#8361).
//
// This resets the webview's zoom back to 1.0 once the page has actually
// finished loading and laid itself out, rather than touching
// WKWebViewConfiguration before load -- which is what caused a real
// layout regression the last time a native zoom-related fix was
// attempted here (see git history: "Revert the ignoresViewportScaleLimits
// pinch-zoom attempt").
class MainViewController: CAPBridgeViewController {
    private var isLoadingObservation: NSKeyValueObservation?

    override func capacitorDidLoad() {
        super.capacitorDidLoad()

        guard let webView = self.webView else { return }

        isLoadingObservation = webView.observe(\.isLoading, options: [.new]) { [weak webView] _, change in
            guard change.newValue == false, let webView = webView else { return }
            DispatchQueue.main.async {
                let scrollView = webView.scrollView
                if scrollView.zoomScale != 1.0 {
                    scrollView.setZoomScale(1.0, animated: false)
                }
            }
        }
    }
}

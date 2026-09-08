import Capacitor
import WebKit

/// Enables pinch-to-zoom of the loaded web content inside the native app.
///
/// The web app's own <meta name="viewport"> (src/app/layout.tsx) never
/// sets maximum-scale or user-scalable=no -- zoom already works fine
/// visiting splitfairwaygolf.com in Mobile Safari, because iOS 10+
/// ignores those viewport restrictions there by default. But a bare
/// WKWebView -- which is what Capacitor wraps this app in -- does NOT
/// get that same default: WKWebViewConfiguration.ignoresViewportScaleLimits
/// is false unless an app opts in, which silently blocks pinch-zoom even
/// though the page itself never asked for that. This subclass is the
/// Capacitor-documented way to reach that setting (see
/// https://capacitorjs.com/docs/ios/viewcontroller); it changes nothing
/// else about how the app loads or behaves.
class MainViewController: CAPBridgeViewController {
    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let configuration = super.webViewConfiguration(for: instanceConfiguration)
        configuration.ignoresViewportScaleLimits = true
        return configuration
    }
}

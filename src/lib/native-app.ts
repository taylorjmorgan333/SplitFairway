/**
 * Appended (not substituted) to the native iOS app's WKWebView user
 * agent -- see ios/App/App/MainViewController.swift's
 * webViewConfiguration. Checking for it in a request's User-Agent
 * header is how server code tells a native-app request apart from a
 * normal browser one, entirely from the request itself, with no
 * client round trip needed.
 */
const NATIVE_APP_UA_TOKEN = "SplitFairwayApp";

export function isNativeAppUserAgent(userAgent: string): boolean {
  return userAgent.includes(NATIVE_APP_UA_TOKEN);
}

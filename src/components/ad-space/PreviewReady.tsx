"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void };
  }
}

/**
 * Tells the HOLD app the preview it opened in a WebView has rendered, so it
 * can drop its own loader: `{ type: "hold-preview-ready" }`, once per render
 * of the page. Outside the app there is no `ReactNativeWebView` and this does
 * nothing. Renders nothing.
 */
export function PreviewReady() {
  useEffect(() => {
    try {
      window.ReactNativeWebView?.postMessage(JSON.stringify({ type: "hold-preview-ready" }));
    } catch {
      // A bridge that throws is the app's to fix; the page is still the page.
    }
  }, []);
  return null;
}

/** Bridge helpers for the Flaze Android/iOS WebView shell (not customer PWA). */

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void };
    __BANAOO_NATIVE_APP__?: boolean;
    __BANAOO_NATIVE_PRINTER_BRIDGE__?: boolean;
  }
}

export const NATIVE_OPEN_BILLING_TYPE = "banaoo-native-open-billing";
export const BILLING_COMPLETE_EVENT = "banaoo-billing-complete";

function getReactNativeHost(): { postMessage: (message: string) => void } | undefined {
  if (typeof window === "undefined") return undefined;
  const direct = window.ReactNativeWebView;
  if (direct?.postMessage) return direct;
  try {
    const topHost = window.top && (window.top as Window).ReactNativeWebView;
    if (topHost?.postMessage) return topHost;
  } catch {
    // cross-origin
  }
  return undefined;
}

/** True when running inside the native Flaze app WebView. */
export function isBanaooNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  if (window.__BANAOO_NATIVE_APP__ || window.__BANAOO_NATIVE_PRINTER_BRIDGE__) return true;
  return !!getReactNativeHost();
}

const API_URL = import.meta.env.VITE_API_URL ?? "";

export type MobileBillingLinkPayload =
  | { kind: "subscription"; plan_type: "starter" | "professional"; period_months: number }
  | {
      kind: "addon";
      addon_type: string;
      quantity: number;
      period_months: number;
    };

export type MobileBillingSettingsTarget = "subscription" | "addons";

/** Request a one-time browser checkout URL (subscription or add-on payment). */
export async function createMobileBillingLink(
  payload: MobileBillingLinkPayload
): Promise<string> {
  const res = await fetch(`${API_URL}/api/billing/mobile-link`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Could not start browser checkout");
  }
  const url = (data as { url?: string }).url;
  if (!url) throw new Error("No checkout URL returned");
  return url;
}

/** Open subscription or add-ons management in the system browser (native app only). */
export async function openBillingSettingsInBrowser(
  target: MobileBillingSettingsTarget = "subscription"
): Promise<void> {
  const res = await fetch(`${API_URL}/api/billing/mobile-link`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "settings", target }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Could not open billing in browser");
  }
  const url = (data as { url?: string }).url;
  if (!url) throw new Error("No billing URL returned");
  openBillingInExternalBrowser(url);
}

/** Ask native shell to open URL in system browser; fallback to new tab on web. */
export function openBillingInExternalBrowser(url: string): boolean {
  const host = getReactNativeHost();
  if (host) {
    host.postMessage(JSON.stringify({ type: NATIVE_OPEN_BILLING_TYPE, url }));
    return true;
  }
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
    __BANAOO_NATIVE_PRINTER_BRIDGE__?: boolean;
    __BANAOO_NATIVE_APP__?: boolean;
  }
}

export const NATIVE_PRINT_BRIDGE_TYPE = "banaoo-native-print";
export const NATIVE_OPEN_PRINTERS_TYPE = "banaoo-native-open-printers";

function getReactNativeHost():
  | {
      postMessage: (message: string) => void;
    }
  | undefined {
  if (typeof window === "undefined") return undefined;
  const direct = window.ReactNativeWebView;
  if (direct?.postMessage) return direct;
  const parentHost = window.parent && (window.parent as any).ReactNativeWebView;
  if (parentHost?.postMessage) return parentHost;
  try {
    const topHost = window.top && (window.top as any).ReactNativeWebView;
    if (topHost?.postMessage) return topHost;
  } catch {
    // Ignore cross-origin top access errors.
  }
  return undefined;
}

export function isReactNativePrintHost(): boolean {
  return !!getReactNativeHost();
}

export function isNativePrinterBridgeExpected(): boolean {
  return typeof window !== "undefined" && !!window.__BANAOO_NATIVE_PRINTER_BRIDGE__;
}

export interface NativeKitchenPrintPayload {
  outletId?: string | null;
  paperWidth?: 58 | 80;
  orderNumber: string;
  orderType: "dine_in" | "takeaway";
  tableNumber?: string;
  items: Array<{ name: string; quantity: number }>;
  createdAt: string;
  /** "cancel" prints a void / do-not-prepare slip for the kitchen. */
  intent?: "order" | "cancel";
  cancelledAt?: string;
}

export interface NativeBillingPrintPayload {
  outletId?: string | null;
  paperWidth?: 58 | 80;
  orderNumber: string;
  outletName: string;
  gstNumber?: string | null;
  orderType: "dine_in" | "takeaway";
  tableNumber?: string;
  items: Array<{ name: string; quantity: number; totalPrice: number; gstRate?: number }>;
  subtotal: number;
  discountAmt: number;
  discountPercent?: number;
  serviceTax: number;
  serviceTaxPercent: number;
  gstTotal: number;
  grandTotal: number;
  createdAt: string;
}

function postToNative(role: "kitchen" | "billing", payload: NativeKitchenPrintPayload | NativeBillingPrintPayload): boolean {
  const host = getReactNativeHost();
  if (!host) return false;
  host.postMessage(
    JSON.stringify({
      type: NATIVE_PRINT_BRIDGE_TYPE,
      role,
      payload,
    })
  );
  return true;
}

export function postNativeKitchenPrint(payload: NativeKitchenPrintPayload): boolean {
  return postToNative("kitchen", { ...payload, intent: payload.intent ?? "order" });
}

export function postNativeKitchenCancelPrint(payload: NativeKitchenPrintPayload): boolean {
  return postToNative("kitchen", { ...payload, intent: "cancel" });
}

export function postNativeBillingPrint(payload: NativeBillingPrintPayload): boolean {
  return postToNative("billing", payload);
}

export function openNativePrinterSettings(): boolean {
  const host = getReactNativeHost();
  if (!host) return false;
  host.postMessage(
    JSON.stringify({
      type: NATIVE_OPEN_PRINTERS_TYPE,
    })
  );
  return true;
}

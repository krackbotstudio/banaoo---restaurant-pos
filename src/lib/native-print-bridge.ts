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
  paperWidthMm?: number;
  paperColumns?: number;
  orderNumber: string;
  orderType: "dine_in" | "takeaway";
  tableNumber?: string;
  items: Array<{ name: string; quantity: number }>;
  createdAt: string;
  source?: string;
  selfServiceMode?: boolean;
  /** "cancel" prints a void / do-not-prepare slip for the kitchen. */
  intent?: "order" | "cancel";
  cancelledAt?: string;
}

export interface NativeCustomerTokenPrintPayload {
  outletId?: string | null;
  paperWidth?: 58 | 80;
  paperWidthMm?: number;
  paperColumns?: number;
  orderNumber: string;
  outletName: string;
  orderType: "dine_in" | "takeaway";
  tableNumber?: string;
  items: Array<{ name: string; quantity: number }>;
  total: number;
  createdAt: string;
  source?: string;
}

export interface NativeBillingPrintPayload {
  outletId?: string | null;
  paperWidth?: 58 | 80;
  paperWidthMm?: number;
  paperColumns?: number;
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
  /** When true, billing job is main customer bill only (self service job 1). */
  selfServiceMainBillOnly?: boolean;
  columnOffset?: number;
  amountColumnWidth?: number;
  boldTotalLine?: boolean;
}

export interface NativeKitchenHandoffPrintPayload {
  outletId?: string | null;
  paperWidth?: 58 | 80;
  paperWidthMm?: number;
  paperColumns?: number;
  orderNumber: string;
  orderType: "dine_in" | "takeaway";
  tableNumber?: string;
  items: Array<{ name: string; quantity: number }>;
  createdAt: string;
  columnOffset?: number;
  amountColumnWidth?: number;
  boldTotalLine?: boolean;
}

function postToNative(
  role: "kitchen" | "billing" | "customer_token" | "kitchen_handoff",
  payload:
    | NativeKitchenPrintPayload
    | NativeBillingPrintPayload
    | NativeCustomerTokenPrintPayload
    | NativeKitchenHandoffPrintPayload
): boolean {
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

export function postNativeKitchenHandoffPrint(payload: NativeKitchenHandoffPrintPayload): boolean {
  return postToNative("kitchen_handoff", payload);
}

export function postNativeCustomerTokenPrint(payload: NativeCustomerTokenPrintPayload): boolean {
  return postToNative("customer_token", payload);
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

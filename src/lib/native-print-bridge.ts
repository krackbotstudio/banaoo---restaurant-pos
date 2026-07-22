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
export const NATIVE_PRINT_RESULT_EVENT = "banaoo-native-print-result";

export type NativePrintRole = "kitchen" | "billing" | "customer_token" | "kitchen_handoff" | "test_print";

export interface NativePrintResultDetail {
  requestId: string;
  ok: boolean;
  message?: string;
}

export type NativePrintWaitResult = { ok: boolean; message?: string };

const NATIVE_PRINT_TIMEOUT_MS = 20_000;

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

/** True when running inside the Flaze app WebView (APK), with or without the inject flag. */
export function isNativePrintCapable(): boolean {
  if (typeof window === "undefined") return false;
  if (window.__BANAOO_NATIVE_PRINTER_BRIDGE__ || window.__BANAOO_NATIVE_APP__) return true;
  return isReactNativePrintHost();
}

export function awaitNativePrintResult(
  requestId: string,
  timeoutMs = NATIVE_PRINT_TIMEOUT_MS
): Promise<NativePrintWaitResult> {
  if (typeof window === "undefined") {
    return Promise.resolve({ ok: false, message: "Native print unavailable" });
  }
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      cleanup();
      resolve({ ok: false, message: "Native print timed out — check Native Printer Settings" });
    }, timeoutMs);

    const handler = (event: Event) => {
      const custom = event as CustomEvent<NativePrintResultDetail>;
      if (custom.detail?.requestId !== requestId) return;
      cleanup();
      resolve({
        ok: custom.detail.ok === true,
        message: custom.detail.message,
      });
    };

    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener(NATIVE_PRINT_RESULT_EVENT, handler);
    };

    window.addEventListener(NATIVE_PRINT_RESULT_EVENT, handler);
  });
}

export const NATIVE_SYNC_SELF_SERVICE_TYPE = "banaoo-native-sync-self-service";

export interface NativeSyncSelfServicePayload {
  outletId: string;
  selfServicePrintOnOrder?: boolean;
  selfServiceBillWithHandoff?: boolean;
  selfServiceKitchenStationCopy?: boolean;
}

export function postNativeSyncSelfServiceSettings(payload: NativeSyncSelfServicePayload): boolean {
  const host = getReactNativeHost();
  if (!host) return false;
  host.postMessage(JSON.stringify({ type: NATIVE_SYNC_SELF_SERVICE_TYPE, payload }));
  return true;
}

export const NATIVE_SYNC_PRINTER_TYPE = "banaoo-native-sync-printer";
export const NATIVE_SCAN_BLUETOOTH_TYPE = "banaoo-native-scan-bluetooth";
export const BT_SCAN_RESULT_EVENT = "banaoo-bt-scan-result";

export interface NativeBluetoothDevice {
  id: string;
  name: string;
}

export interface NativeSyncPrinterPayload {
  outletId: string;
  role: "kitchen" | "billing";
  name: string;
  transport: "network" | "bluetooth-classic" | "bluetooth-ble";
  connectionId: string;
  networkHost?: string;
  networkPort?: number;
  serviceUUID?: string;
  characteristicUUID?: string;
  enabled?: boolean;
}

export function postNativeSyncPrinter(payload: NativeSyncPrinterPayload): boolean {
  const host = getReactNativeHost();
  if (!host) return false;
  host.postMessage(JSON.stringify({ type: NATIVE_SYNC_PRINTER_TYPE, payload }));
  return true;
}

export function postNativeBluetoothScan(mode: "ble" | "classic"): boolean {
  const host = getReactNativeHost();
  if (!host) return false;
  host.postMessage(JSON.stringify({ type: NATIVE_SCAN_BLUETOOTH_TYPE, mode }));
  return true;
}

export function subscribeBluetoothScanResult(
  listener: (detail: { devices: NativeBluetoothDevice[]; error?: string }) => void
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    const custom = event as CustomEvent<{ devices?: NativeBluetoothDevice[]; error?: string }>;
    listener({
      devices: custom.detail?.devices ?? [],
      error: custom.detail?.error,
    });
  };
  window.addEventListener(BT_SCAN_RESULT_EVENT, handler);
  return () => window.removeEventListener(BT_SCAN_RESULT_EVENT, handler);
}

export interface NativeKitchenPrintPayload {
  outletId?: string | null;
  printerId?: string;
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
  printerId?: string;
  paperWidth?: 58 | 80;
  paperWidthMm?: number;
  paperColumns?: number;
  orderNumber: string;
  restaurantName?: string;
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
  printerId?: string;
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

export interface NativeTestPrintPayload {
  outletId?: string | null;
  role: "kitchen" | "billing";
  printerId?: string;
}

async function postToNativeAndWait(
  role: NativePrintRole,
  payload:
    | NativeKitchenPrintPayload
    | NativeBillingPrintPayload
    | NativeCustomerTokenPrintPayload
    | NativeKitchenHandoffPrintPayload
    | NativeTestPrintPayload
): Promise<NativePrintWaitResult> {
  const host = getReactNativeHost();
  if (!host) {
    return { ok: false, message: "Native printer bridge unavailable" };
  }
  const requestId = crypto.randomUUID();
  const resultPromise = awaitNativePrintResult(requestId);
  host.postMessage(
    JSON.stringify({
      type: NATIVE_PRINT_BRIDGE_TYPE,
      role,
      requestId,
      payload,
    })
  );
  return resultPromise;
}

export async function postNativeKitchenPrint(payload: NativeKitchenPrintPayload): Promise<NativePrintWaitResult> {
  return postToNativeAndWait("kitchen", { ...payload, intent: payload.intent ?? "order" });
}

export async function postNativeKitchenCancelPrint(
  payload: NativeKitchenPrintPayload
): Promise<NativePrintWaitResult> {
  return postToNativeAndWait("kitchen", { ...payload, intent: "cancel" });
}

export async function postNativeBillingPrint(payload: NativeBillingPrintPayload): Promise<NativePrintWaitResult> {
  return postToNativeAndWait("billing", payload);
}

export async function postNativeKitchenHandoffPrint(
  payload: NativeKitchenHandoffPrintPayload
): Promise<NativePrintWaitResult> {
  return postToNativeAndWait("kitchen_handoff", payload);
}

export async function postNativeCustomerTokenPrint(
  payload: NativeCustomerTokenPrintPayload
): Promise<NativePrintWaitResult> {
  return postToNativeAndWait("customer_token", payload);
}

export async function postNativeTestPrint(payload: NativeTestPrintPayload): Promise<NativePrintWaitResult> {
  return postToNativeAndWait("test_print", payload);
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

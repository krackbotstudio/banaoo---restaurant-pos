import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  InteractionManager,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import * as Updates from "expo-updates";
import Constants from "expo-constants";
import { APP_VERSION } from "../lib/app-version";
import { API_URL, WEBAPP_URL } from "../lib/config";
import {
  applyRuntimePaperFromPayload,
  printBillingReceipt,
  printCustomerTokenSlip,
  printKitchenCancelSlip,
  printKitchenHandoffReceipt,
  printKitchenSlip,
} from "../printer/printer-service";
import { loadEffectivePrinterSettings } from "../printer/printer-storage";
import {
  buildBluetoothScanInjectScript,
  handleWebSyncPrinter,
  handleWebSyncSelfServiceSettings,
  scanBluetoothForWeb,
  type WebSyncPrinterPayload,
} from "../printer/web-bridge-handlers";
import { tokens } from "../theme/tokens";

interface PwaShellScreenProps {
  onOpenPrinters: () => void;
}

type BridgeRole = "kitchen" | "billing" | "customer_token" | "kitchen_handoff";
type KitchenItem = { name: string; quantity: number };
type BillingItem = { name: string; quantity: number; totalPrice: number; gstRate?: number };

interface BridgeMessage {
  type:
    | "banaoo-native-print"
    | "banaoo-native-open-printers"
    | "banaoo-native-sync-printer"
    | "banaoo-native-sync-self-service"
    | "banaoo-native-scan-bluetooth";
  role?: BridgeRole;
  payload?: Record<string, unknown>;
  mode?: "ble" | "classic";
}

const OTA_CHECK_INTERVAL_MS = 5 * 60 * 1000;

/** If `onLoadEnd` never fires (redirect quirks, blank doc), do not block the shell forever. */
const PAGE_READY_FAILSAFE_MS = 22_000;

const INJECT_BEFORE_LOAD = `(function(){window.__BANAOO_NATIVE_PRINTER_BRIDGE__=true;window.__BANAOO_NATIVE_APP__=true;})();true;`;
const INJECT_AFTER_LOAD = `(function(){try{Object.defineProperty(navigator,'serial',{value:undefined,configurable:true});}catch(e){}})();true;`;

/** Chrome-like UA so PWAs that sniff WebView do not block the shell (Android). */
const ANDROID_WEBVIEW_UA = `Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36 BanaooApp/${APP_VERSION}`;

function versionToParts(version: string): number[] {
  return version
    .split(".")
    .map((segment) => Number.parseInt(segment.replace(/[^\d].*$/, ""), 10))
    .map((n) => (Number.isFinite(n) ? n : 0));
}

function compareVersions(a: string, b: string): number {
  const aParts = versionToParts(a);
  const bParts = versionToParts(b);
  const maxLen = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < maxLen; i += 1) {
    const av = aParts[i] ?? 0;
    const bv = bParts[i] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

function rootUrl() {
  const trimmedBase = WEBAPP_URL.replace(/\/+$/, "");
  return `${trimmedBase}/auth`;
}

function isValidMessage(data: unknown): data is BridgeMessage {
  if (!data || typeof data !== "object") return false;
  const candidate = data as Partial<BridgeMessage>;
  if (candidate.type === "banaoo-native-open-printers") return true;
  if (candidate.type === "banaoo-native-sync-printer") return !!candidate.payload;
  if (candidate.type === "banaoo-native-sync-self-service") return !!candidate.payload;
  if (candidate.type === "banaoo-native-scan-bluetooth") {
    return candidate.mode === "ble" || candidate.mode === "classic";
  }
  return (
    candidate.type === "banaoo-native-print" &&
    (candidate.role === "kitchen" ||
      candidate.role === "billing" ||
      candidate.role === "customer_token" ||
      candidate.role === "kitchen_handoff") &&
    !!candidate.payload &&
    typeof candidate.payload === "object"
  );
}

function asKitchenItems(input: unknown): KitchenItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const name = typeof row.name === "string" ? row.name.slice(0, 160) : "";
      const quantity = typeof row.quantity === "number" ? row.quantity : 0;
      if (!name || quantity <= 0) return null;
      return { name, quantity };
    })
    .filter((item): item is KitchenItem => item !== null);
}

function asBillingItems(input: unknown): BillingItem[] {
  if (!Array.isArray(input)) return [];
  const rows: BillingItem[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name.slice(0, 160) : "";
    const quantity = typeof row.quantity === "number" ? row.quantity : 0;
    const totalPrice = typeof row.totalPrice === "number" ? row.totalPrice : 0;
    const gstRate = typeof row.gstRate === "number" ? row.gstRate : undefined;
    if (!name || quantity <= 0) continue;
    rows.push({ name, quantity, totalPrice, gstRate });
  }
  return rows;
}

export function PwaShellScreen({ onOpenPrinters }: PwaShellScreenProps) {
  const [reloadKey, setReloadKey] = useState(0);
  /** Defer mounting WebView until after first interactions to reduce cold-start ANR risk. */
  const [mountWeb, setMountWeb] = useState(false);
  /** Main document finished loading (per WebView instance / reloadKey). */
  const [pageReady, setPageReady] = useState(false);
  const [slowLoadHint, setSlowLoadHint] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const firstLoadDoneRef = useRef(false);
  const webViewRef = useRef<WebView>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [forceUpdateRequired, setForceUpdateRequired] = useState(false);
  const [forceUpdateMessage, setForceUpdateMessage] = useState<string | null>(null);
  const [applyingUpdate, setApplyingUpdate] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const url = useMemo(() => rootUrl(), []);
  const appVersion = useMemo(() => {
    return (
      Constants.expoConfig?.version ||
      Constants.nativeAppVersion ||
      "0.0.0"
    );
  }, []);

  const checkForOtaUpdate = async () => {
    if (__DEV__ || !Updates.isEnabled) return;
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        setUpdateAvailable(true);
        setUpdateError(null);
      }
    } catch {
      // Keep silent in UI for routine background checks.
    }
  };

  const applyOtaUpdate = async () => {
    if (__DEV__ || !Updates.isEnabled) return;
    setApplyingUpdate(true);
    setUpdateError(null);
    try {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch {
      setUpdateError("Update failed. Please try again.");
      setApplyingUpdate(false);
    }
  };

  const checkForceUpdatePolicy = async () => {
    try {
      const response = await fetch(`${API_URL}/api/mobile-app/update-policy`);
      if (!response.ok) return;
      const data = (await response.json()) as {
        minVersion?: string;
        forceUpdate?: boolean;
        message?: string;
      };
      const minVersion = typeof data.minVersion === "string" ? data.minVersion : "0.0.0";
      const forceUpdate = Boolean(data.forceUpdate);
      const mustUpdate = forceUpdate && compareVersions(appVersion, minVersion) < 0;
      setForceUpdateRequired(mustUpdate);
      setForceUpdateMessage(mustUpdate ? data.message || "A critical update is required." : null);
    } catch {
      // Keep previous value if network fails.
    }
  };

  useEffect(() => {
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (!cancelled) setMountWeb(true);
    });
    const fallback = setTimeout(() => {
      if (!cancelled) setMountWeb(true);
    }, 2000);
    return () => {
      cancelled = true;
      task.cancel();
      clearTimeout(fallback);
    };
  }, []);

  useEffect(() => {
    const onUrl = ({ url: incomingUrl }: { url: string }) => {
      if (incomingUrl.toLowerCase().startsWith("banaoo://")) {
        setLoadError(null);
        setReloadKey((prev) => prev + 1);
      }
    };

    const sub = Linking.addEventListener("url", onUrl);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    firstLoadDoneRef.current = false;
    setPageReady(false);
    setSlowLoadHint(false);
  }, [reloadKey]);

  useEffect(() => {
    if (!mountWeb || pageReady || !WEBAPP_URL) {
      return;
    }
    setSlowLoadHint(false);
    const slowTimer = setTimeout(() => setSlowLoadHint(true), 8000);
    return () => clearTimeout(slowTimer);
  }, [mountWeb, pageReady, reloadKey]);

  useEffect(() => {
    if (!mountWeb || pageReady || loadError) return;
    const t = setTimeout(() => {
      setPageReady(true);
      setSlowLoadHint(false);
    }, PAGE_READY_FAILSAFE_MS);
    return () => clearTimeout(t);
  }, [mountWeb, pageReady, loadError, reloadKey]);

  useEffect(() => {
    void checkForOtaUpdate();
    void checkForceUpdatePolicy();
    const interval = setInterval(() => {
      void checkForOtaUpdate();
      void checkForceUpdatePolicy();
    }, OTA_CHECK_INTERVAL_MS);
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void checkForOtaUpdate();
        void checkForceUpdatePolicy();
      }
    });
    return () => {
      clearInterval(interval);
      appStateSub.remove();
    };
  }, []);

  const handleWebMessage = async (event: WebViewMessageEvent) => {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (!isValidMessage(parsed)) return;
    if (parsed.type === "banaoo-native-open-printers") {
      onOpenPrinters();
      return;
    }

    if (parsed.type === "banaoo-native-sync-printer") {
      const p = parsed.payload as Partial<WebSyncPrinterPayload>;
      if (
        typeof p.outletId === "string" &&
        (p.role === "kitchen" || p.role === "billing") &&
        typeof p.name === "string" &&
        typeof p.transport === "string" &&
        typeof p.connectionId === "string"
      ) {
        await handleWebSyncPrinter({
          outletId: p.outletId,
          role: p.role,
          name: p.name,
          transport: p.transport as WebSyncPrinterPayload["transport"],
          connectionId: p.connectionId,
          networkHost: typeof p.networkHost === "string" ? p.networkHost : "",
          networkPort: typeof p.networkPort === "number" ? p.networkPort : 9100,
          serviceUUID: typeof p.serviceUUID === "string" ? p.serviceUUID : "",
          characteristicUUID: typeof p.characteristicUUID === "string" ? p.characteristicUUID : "",
          enabled: p.enabled !== false,
        });
      }
      return;
    }

    if (parsed.type === "banaoo-native-sync-self-service") {
      const p = parsed.payload as Record<string, unknown>;
      if (typeof p.outletId === "string") {
        await handleWebSyncSelfServiceSettings({
          outletId: p.outletId,
          selfServicePrintOnOrder:
            typeof p.selfServicePrintOnOrder === "boolean" ? p.selfServicePrintOnOrder : undefined,
          selfServiceBillWithHandoff:
            typeof p.selfServiceBillWithHandoff === "boolean" ? p.selfServiceBillWithHandoff : undefined,
          selfServiceKitchenStationCopy:
            typeof p.selfServiceKitchenStationCopy === "boolean"
              ? p.selfServiceKitchenStationCopy
              : undefined,
        });
      }
      return;
    }

    if (parsed.type === "banaoo-native-scan-bluetooth") {
      const mode = parsed.mode ?? "classic";
      try {
        const devices = await scanBluetoothForWeb(mode);
        webViewRef.current?.injectJavaScript(buildBluetoothScanInjectScript(devices));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        webViewRef.current?.injectJavaScript(buildBluetoothScanInjectScript([], message));
      }
      return;
    }

    const payload = parsed.payload as Record<string, unknown>;
    const outletId = typeof payload.outletId === "string" ? payload.outletId : undefined;
    let settings = await loadEffectivePrinterSettings(outletId);

    if (parsed.role === "kitchen") {
      settings = applyRuntimePaperFromPayload(settings, "kitchen", payload);
      const orderNumber = typeof payload.orderNumber === "string" ? payload.orderNumber.slice(0, 80) : "";
      const createdAt = typeof payload.createdAt === "string" ? new Date(payload.createdAt) : null;
      const orderTypeRaw = payload.orderType === "dine_in" || payload.orderType === "takeaway" ? payload.orderType : null;
      const items = asKitchenItems(payload.items);
      if (!orderNumber || !createdAt || Number.isNaN(createdAt.getTime()) || !orderTypeRaw || items.length === 0) return;
      const slipData = {
        orderNumber,
        orderType: orderTypeRaw,
        tableNumber: typeof payload.tableNumber === "string" ? payload.tableNumber.slice(0, 24) : undefined,
        items,
        createdAt,
        source: typeof payload.source === "string" ? payload.source.slice(0, 40) : undefined,
        selfServiceMode: payload.selfServiceMode === true,
      };
      const intent = payload.intent === "cancel" ? "cancel" : "order";
      if (intent === "cancel") {
        const cancelledAt =
          typeof payload.cancelledAt === "string" ? new Date(payload.cancelledAt) : new Date();
        await printKitchenCancelSlip(
          settings,
          slipData,
          Number.isNaN(cancelledAt.getTime()) ? new Date() : cancelledAt
        );
      } else {
        await printKitchenSlip(settings, slipData);
      }
      return;
    }

    if (parsed.role === "customer_token") {
      const orderNumber = typeof payload.orderNumber === "string" ? payload.orderNumber.slice(0, 80) : "";
      const createdAt = typeof payload.createdAt === "string" ? new Date(payload.createdAt) : null;
      const orderTypeRaw = payload.orderType === "dine_in" || payload.orderType === "takeaway" ? payload.orderType : null;
      const items = asKitchenItems(payload.items);
      const outletName = typeof payload.outletName === "string" ? payload.outletName.slice(0, 120) : "";
      const total = typeof payload.total === "number" ? payload.total : 0;
      if (!orderNumber || !createdAt || Number.isNaN(createdAt.getTime()) || !orderTypeRaw || items.length === 0) return;
      await printCustomerTokenSlip(settings, {
        orderNumber,
        outletName,
        orderType: orderTypeRaw,
        tableNumber: typeof payload.tableNumber === "string" ? payload.tableNumber.slice(0, 24) : undefined,
        items,
        total,
        createdAt,
        source: typeof payload.source === "string" ? payload.source.slice(0, 40) : undefined,
      });
      return;
    }

    if (parsed.role === "kitchen_handoff") {
      const orderNumber = typeof payload.orderNumber === "string" ? payload.orderNumber.slice(0, 80) : "";
      const createdAt = typeof payload.createdAt === "string" ? new Date(payload.createdAt) : null;
      const orderTypeRaw =
        payload.orderType === "dine_in" || payload.orderType === "takeaway" ? payload.orderType : null;
      const items = asKitchenItems(payload.items);
      if (!orderNumber || !createdAt || Number.isNaN(createdAt.getTime()) || !orderTypeRaw || items.length === 0) {
        return;
      }
      await printKitchenHandoffReceipt(settings, {
        orderNumber,
        orderType: orderTypeRaw,
        tableNumber: typeof payload.tableNumber === "string" ? payload.tableNumber.slice(0, 24) : undefined,
        items,
        createdAt,
      });
      return;
    }

    if (parsed.role === "billing") {
      const orderNumber = typeof payload.orderNumber === "string" ? payload.orderNumber.slice(0, 80) : "";
      const createdAt = typeof payload.createdAt === "string" ? new Date(payload.createdAt) : null;
      const orderTypeRaw =
        payload.orderType === "dine_in" || payload.orderType === "takeaway" ? payload.orderType : null;
      const items = asBillingItems(payload.items);
      const outletName = typeof payload.outletName === "string" ? payload.outletName.slice(0, 120) : "";
      if (!orderNumber || !createdAt || Number.isNaN(createdAt.getTime()) || !orderTypeRaw || !outletName || items.length === 0) {
        return;
      }

      const selfServiceMainBillOnly = payload.selfServiceMainBillOnly === true;

      await printBillingReceipt(
        settings,
        {
          orderNumber,
          restaurantName:
            typeof payload.restaurantName === "string" ? payload.restaurantName.slice(0, 120) : undefined,
          outletName,
          gstNumber: typeof payload.gstNumber === "string" ? payload.gstNumber : undefined,
          orderType: orderTypeRaw,
          tableNumber: typeof payload.tableNumber === "string" ? payload.tableNumber.slice(0, 24) : undefined,
          items,
          subtotal: typeof payload.subtotal === "number" ? payload.subtotal : 0,
          discountAmt: typeof payload.discountAmt === "number" ? payload.discountAmt : 0,
          discountPercent: typeof payload.discountPercent === "number" ? payload.discountPercent : undefined,
          serviceTax: typeof payload.serviceTax === "number" ? payload.serviceTax : 0,
          serviceTaxPercent: typeof payload.serviceTaxPercent === "number" ? payload.serviceTaxPercent : 0,
          gstTotal: typeof payload.gstTotal === "number" ? payload.gstTotal : 0,
          grandTotal: typeof payload.grandTotal === "number" ? payload.grandTotal : 0,
          createdAt,
        },
        { selfServiceMainBillOnly }
      );
    }
  };

  if (!WEBAPP_URL) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.title}>Banaoo POS Mobile</Text>
        <Text style={styles.text}>Set EXPO_PUBLIC_WEBAPP_URL in mobile/.env to render the POS shell.</Text>
      </View>
    );
  }

  if (!mountWeb) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.startGate}>
          <ActivityIndicator size="large" color={tokens.colors.primary} />
          <Text style={styles.startGateText}>Starting…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Modal visible={!pageReady && !loadError} transparent animationType="fade">
        <View style={styles.loadModalRoot} pointerEvents="box-none">
          <View style={styles.loadModalCard}>
            <ActivityIndicator size="large" color={tokens.colors.primary} />
            <Text style={styles.loadModalTitle}>Loading POS…</Text>
            {slowLoadHint ? (
              <Text style={styles.loadModalHint}>Taking longer than usual — check your connection.</Text>
            ) : null}
          </View>
        </View>
      </Modal>
      {loadError ? (
        <View style={styles.errorStrip}>
          <Text style={styles.errorText}>{loadError}</Text>
        </View>
      ) : null}
      <WebView
        ref={webViewRef}
        key={`pwa-shell-${reloadKey}`}
        source={{ uri: url }}
        style={styles.webview}
        userAgent={Platform.OS === "android" ? ANDROID_WEBVIEW_UA : undefined}
        injectedJavaScriptBeforeContentLoaded={INJECT_BEFORE_LOAD}
        injectedJavaScript={INJECT_AFTER_LOAD}
        onLoadStart={() => {}}
        onLoadEnd={() => {
          firstLoadDoneRef.current = true;
          setPageReady(true);
          setSlowLoadHint(false);
        }}
        onError={({ nativeEvent }) => {
          firstLoadDoneRef.current = true;
          setPageReady(true);
          setSlowLoadHint(false);
          setLoadError(`WebView error: ${nativeEvent.description || "Failed to load POS."}`);
        }}
        onHttpError={({ nativeEvent }) => {
          firstLoadDoneRef.current = true;
          setPageReady(true);
          setSlowLoadHint(false);
          setLoadError(`POS HTTP error: ${nativeEvent.statusCode}`);
        }}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        onMessage={handleWebMessage}
      />
      {(updateAvailable || forceUpdateRequired) ? (
        <View style={styles.updateBanner}>
          <View style={styles.updateTextWrap}>
            <Text style={styles.updateTitle}>
              {forceUpdateRequired ? "Update required" : "Update available"}
            </Text>
            <Text style={styles.updateSubtitle}>
              {forceUpdateRequired
                ? forceUpdateMessage || "Please update to continue using the app."
                : "Tap to install the latest app improvements."}
            </Text>
            {updateError ? <Text style={styles.updateError}>{updateError}</Text> : null}
          </View>
          <Pressable
            style={[styles.updateBtn, applyingUpdate && styles.updateBtnDisabled]}
            onPress={() => void applyOtaUpdate()}
            disabled={applyingUpdate}
          >
            {applyingUpdate ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.updateBtnText}>Update</Text>
            )}
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  startGate: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
  },
  startGateText: {
    fontSize: 15,
    fontWeight: "600",
    color: tokens.colors.mutedForeground,
  },
  loadModalRoot: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.96)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadModalCard: {
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    maxWidth: 280,
  },
  loadModalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: tokens.colors.mutedForeground,
    textAlign: "center",
  },
  loadModalHint: {
    fontSize: 13,
    color: tokens.colors.mutedForeground,
    textAlign: "center",
    lineHeight: 18,
  },
  errorStrip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fee2e2",
    borderBottomWidth: 1,
    borderBottomColor: "#fecaca",
  },
  errorText: {
    color: "#991b1b",
    fontWeight: "600",
    fontSize: 12,
  },
  webview: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  updateBanner: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 14,
    zIndex: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fed7aa",
    backgroundColor: "#fff7ed",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  updateTextWrap: {
    flex: 1,
  },
  updateTitle: {
    color: "#9a3412",
    fontSize: 13,
    fontWeight: "700",
  },
  updateSubtitle: {
    color: "#7c2d12",
    fontSize: 12,
    marginTop: 2,
  },
  updateError: {
    color: "#b91c1c",
    fontSize: 11,
    marginTop: 2,
    fontWeight: "600",
  },
  updateBtn: {
    backgroundColor: tokens.colors.primary,
    borderRadius: 8,
    minWidth: 88,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  updateBtnDisabled: {
    opacity: 0.8,
  },
  updateBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  fallback: {
    flex: 1,
    backgroundColor: tokens.colors.mutedBackground,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 20,
  },
  title: {
    fontSize: tokens.typography.heading,
    fontWeight: "700",
    color: tokens.colors.foreground,
  },
  text: {
    color: tokens.colors.mutedForeground,
    textAlign: "center",
    lineHeight: 20,
  },
});

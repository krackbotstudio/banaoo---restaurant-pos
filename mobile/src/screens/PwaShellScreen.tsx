import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, AppState, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import * as Updates from "expo-updates";
import Constants from "expo-constants";
import { API_URL, WEBAPP_URL } from "../lib/config";
import { printBillingReceipt, printKitchenSlip } from "../printer/printer-service";
import { loadEffectivePrinterSettings } from "../printer/printer-storage";
import { tokens } from "../theme/tokens";

interface PwaShellScreenProps {
  onOpenPrinters: () => void;
}

type BridgeRole = "kitchen" | "billing";
type KitchenItem = { name: string; quantity: number };
type BillingItem = { name: string; quantity: number; totalPrice: number; gstRate?: number };

interface BridgeMessage {
  type: "banaoo-native-print" | "banaoo-native-open-printers";
  role: BridgeRole;
  payload: Record<string, unknown>;
}

const OTA_CHECK_INTERVAL_MS = 5 * 60 * 1000;

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
  return (
    candidate.type === "banaoo-native-print" &&
    (candidate.role === "kitchen" || candidate.role === "billing") &&
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
    // Failsafe: some WebView navigations can keep firing load-start events.
    const timer = setTimeout(() => setLoading(false), 12000);
    return () => clearTimeout(timer);
  }, [reloadKey]);

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

    const payload = parsed.payload as Record<string, unknown>;
    const outletId = typeof payload.outletId === "string" ? payload.outletId : undefined;
    const settings = await loadEffectivePrinterSettings(outletId);
    const requestedPaperWidth = payload.paperWidth === 80 ? 80 : payload.paperWidth === 58 ? 58 : undefined;

    if (parsed.role === "kitchen") {
      const orderNumber = typeof payload.orderNumber === "string" ? payload.orderNumber.slice(0, 80) : "";
      const createdAt = typeof payload.createdAt === "string" ? new Date(payload.createdAt) : null;
      const orderTypeRaw = payload.orderType === "dine_in" || payload.orderType === "takeaway" ? payload.orderType : null;
      const items = asKitchenItems(payload.items);
      if (!orderNumber || !createdAt || Number.isNaN(createdAt.getTime()) || !orderTypeRaw || items.length === 0) return;
      const runtimeSettings = requestedPaperWidth
        ? { ...settings, kitchenPrinter: { ...settings.kitchenPrinter, paperWidth: requestedPaperWidth } }
        : settings;
      await printKitchenSlip(runtimeSettings, {
        orderNumber,
        orderType: orderTypeRaw,
        tableNumber: typeof payload.tableNumber === "string" ? payload.tableNumber.slice(0, 24) : undefined,
        items,
        createdAt,
      });
      return;
    }

    const orderNumber = typeof payload.orderNumber === "string" ? payload.orderNumber.slice(0, 80) : "";
    const createdAt = typeof payload.createdAt === "string" ? new Date(payload.createdAt) : null;
    const orderTypeRaw = payload.orderType === "dine_in" || payload.orderType === "takeaway" ? payload.orderType : null;
    const items = asBillingItems(payload.items);
    const outletName = typeof payload.outletName === "string" ? payload.outletName.slice(0, 120) : "";
    if (!orderNumber || !createdAt || Number.isNaN(createdAt.getTime()) || !orderTypeRaw || !outletName || items.length === 0) return;

    const runtimeSettings = requestedPaperWidth
      ? { ...settings, billingPrinter: { ...settings.billingPrinter, paperWidth: requestedPaperWidth } }
      : settings;
    await printBillingReceipt(runtimeSettings, {
      orderNumber,
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
    });
  };

  if (!WEBAPP_URL) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.title}>Banaoo POS Mobile</Text>
        <Text style={styles.text}>Set EXPO_PUBLIC_WEBAPP_URL in mobile/.env to render the POS shell.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {loadError ? (
        <View style={styles.errorStrip}>
          <Text style={styles.errorText}>{loadError}</Text>
        </View>
      ) : null}
      {loading ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>Loading POS...</Text>
        </View>
      ) : null}
      <WebView
        key={`pwa-shell-${reloadKey}`}
        source={{ uri: url }}
        style={styles.webview}
        injectedJavaScriptBeforeContentLoaded={`(function(){window.__BANAOO_NATIVE_PRINTER_BRIDGE__=true;window.__BANAOO_NATIVE_APP__=true;try{Object.defineProperty(navigator,'serial',{value:undefined,configurable:true});}catch(e){}})();true;`}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onLoadProgress={({ nativeEvent }) => {
          if (nativeEvent.progress >= 0.9) setLoading(false);
        }}
        onError={({ nativeEvent }) => {
          setLoading(false);
          setLoadError(`WebView error: ${nativeEvent.description || "Failed to load POS."}`);
        }}
        onHttpError={({ nativeEvent }) => {
          setLoading(false);
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
  loadingOverlay: {
    position: "absolute",
    zIndex: 10,
    top: 0,
    left: 0,
    right: 0,
    padding: 8,
    backgroundColor: tokens.colors.warningBackground,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    color: tokens.colors.warningForeground,
    fontWeight: "600",
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

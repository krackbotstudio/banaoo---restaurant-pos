import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { WEBAPP_URL } from "../lib/config";
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
  const url = useMemo(() => rootUrl(), []);

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

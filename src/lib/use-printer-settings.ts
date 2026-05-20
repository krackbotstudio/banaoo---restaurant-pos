import { useState, useEffect } from "react";
import type { PrinterTransport } from "@/lib/printer-types";
import { DEFAULT_NETWORK_PORT } from "@/lib/printer-types";
import {
  resolvePaperLayout,
  paperLayoutToStorage,
  coercePaperWidthPreset,
  type PaperWidthPresetId,
} from "@/lib/paper-width";
import type { EscPosPrintOptions } from "@/lib/serial-printer";
import { syncSelfServicePrintToNative } from "@/lib/sync-native-self-service";

export type { PrinterTransport };

/** @deprecated use PrinterTransport */
export type PrinterConnectionType = "bluetooth" | "usb" | "none";

export type PrintMode = "serial" | "browser";

export interface PrinterConfig {
  name: string;
  /** Primary connection method for this role */
  transport: PrinterTransport;
  /** @deprecated — derived from transport */
  connectionType: PrinterConnectionType;
  /** @deprecated use paperWidthMm — kept for native bridge compatibility */
  paperWidth: 58 | 80;
  paperWidthPreset: PaperWidthPresetId;
  paperWidthMm: number;
  paperColumns: number;
  autoPrint: boolean;
  fontSize: number;
  baudRate: 9600 | 19200 | 38400 | 115200;
  printMode: PrintMode;
  lastTestedAt?: string;
  usbPortIndex: number | null;
  networkHost: string;
  networkPort: number;
  postPrintFeedLines: number;
  showTearCutLine: boolean;
  dualKitchenCopies: boolean;
  dualBillingCopies: boolean;
  /** Left margin in character spaces (0–4). */
  columnOffset: number;
  /** Width reserved for amount column on item lines (8–14). */
  amountColumnWidth: number;
  /** Bold TOTAL line (avoid double-width on 58mm — causes wrap). */
  boldTotalLine: boolean;
  /** Self service: print full bill + kitchen handoff on billing printer when order is placed. */
  selfServicePrintOnOrder: boolean;
  /** Self service: include items/qty-only slip after cut (take to kitchen). */
  selfServiceBillWithHandoff: boolean;
  /** Self service: also print kitchen station slip on kitchen printer. */
  selfServiceKitchenStationCopy: boolean;
}

export interface OutletPrinterSettings {
  kitchenPrinter: PrinterConfig;
  billingPrinter: PrinterConfig;
  version: 2;
}

const DEFAULT_PRINTER: PrinterConfig = {
  name: "",
  transport: "browser",
  connectionType: "none",
  paperWidth: 58,
  paperWidthPreset: "58",
  paperWidthMm: 58,
  paperColumns: 32,
  autoPrint: false,
  fontSize: 12,
  baudRate: 9600,
  printMode: "browser",
  usbPortIndex: null,
  networkHost: "",
  networkPort: DEFAULT_NETWORK_PORT,
  postPrintFeedLines: 4,
  showTearCutLine: true,
  dualKitchenCopies: false,
  dualBillingCopies: false,
  columnOffset: 0,
  amountColumnWidth: 10,
  boldTotalLine: false,
  selfServicePrintOnOrder: true,
  selfServiceBillWithHandoff: true,
  selfServiceKitchenStationCopy: false,
};

const DEFAULT_SETTINGS: OutletPrinterSettings = {
  kitchenPrinter: { ...DEFAULT_PRINTER },
  billingPrinter: { ...DEFAULT_PRINTER },
  version: 2,
};

function deriveLegacyConnectionType(transport: PrinterTransport): PrinterConnectionType {
  if (transport === "bluetooth") return "bluetooth";
  if (transport === "usb") return "usb";
  return "none";
}

function normalizePrinterConfig(raw?: Partial<PrinterConfig>): PrinterConfig {
  const merged: PrinterConfig = { ...DEFAULT_PRINTER, ...raw };

  // Infer transport from legacy fields when missing
  if (!raw?.transport) {
    if (merged.networkHost?.trim()) {
      merged.transport = "network";
    } else if (merged.usbPortIndex !== null) {
      merged.transport = merged.connectionType === "bluetooth" ? "bluetooth" : "usb";
      merged.printMode = "serial";
    } else if (merged.printMode === "serial") {
      merged.transport = merged.connectionType === "bluetooth" ? "bluetooth" : "usb";
    } else {
      merged.transport = "browser";
    }
  }

  merged.connectionType = deriveLegacyConnectionType(merged.transport);

  if (merged.transport === "network") {
    merged.printMode = "serial";
  }

  if (
    merged.usbPortIndex !== null &&
    merged.printMode === "browser" &&
    (merged.transport === "usb" || merged.transport === "bluetooth")
  ) {
    merged.printMode = "serial";
  }

  const feed = merged.postPrintFeedLines;
  merged.postPrintFeedLines =
    typeof feed === "number" && Number.isFinite(feed)
      ? Math.min(24, Math.max(1, Math.round(feed)))
      : DEFAULT_PRINTER.postPrintFeedLines;
  merged.showTearCutLine = merged.showTearCutLine !== false;
  merged.dualKitchenCopies = merged.dualKitchenCopies === true;
  merged.dualBillingCopies = merged.dualBillingCopies === true;
  merged.columnOffset = Math.min(4, Math.max(0, Math.round(merged.columnOffset ?? 0)));
  merged.amountColumnWidth = Math.min(
    14,
    Math.max(8, Math.round(merged.amountColumnWidth ?? DEFAULT_PRINTER.amountColumnWidth))
  );
  merged.boldTotalLine = merged.boldTotalLine === true;
  merged.selfServicePrintOnOrder = merged.selfServicePrintOnOrder !== false;
  merged.selfServiceBillWithHandoff = merged.selfServiceBillWithHandoff !== false;
  merged.selfServiceKitchenStationCopy = merged.selfServiceKitchenStationCopy === true;
  const coercedPreset = coercePaperWidthPreset(merged.paperWidthPreset);
  if (coercedPreset) {
    merged.paperWidthPreset = coercedPreset;
  } else if (merged.paperWidthPreset != null) {
    merged.paperWidthPreset = DEFAULT_PRINTER.paperWidthPreset;
  }
  merged.networkPort =
    typeof merged.networkPort === "number" && merged.networkPort > 0
      ? merged.networkPort
      : DEFAULT_NETWORK_PORT;

  const layout = resolvePaperLayout(merged);
  const stored = paperLayoutToStorage(layout);
  merged.paperWidthPreset = stored.paperWidthPreset!;
  merged.paperWidthMm = stored.paperWidthMm!;
  merged.paperColumns = stored.paperColumns!;
  merged.paperWidth = stored.paperWidth!;

  return merged;
}

function readFromStorage(key: string): OutletPrinterSettings {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as OutletPrinterSettings;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      version: 2,
      kitchenPrinter: normalizePrinterConfig(parsed.kitchenPrinter),
      billingPrinter: normalizePrinterConfig(parsed.billingPrinter),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function usePrinterSettings(outletId: string | null | undefined) {
  const key = outletId ? `printer_settings_${outletId}` : null;

  const [settings, setSettings] = useState<OutletPrinterSettings>(() =>
    key ? readFromStorage(key) : DEFAULT_SETTINGS
  );

  useEffect(() => {
    setSettings(key ? readFromStorage(key) : DEFAULT_SETTINGS);
  }, [key]);

  useEffect(() => {
    if (!outletId) return;
    syncSelfServicePrintToNative(outletId, settings.billingPrinter);
  }, [
    outletId,
    settings.billingPrinter.selfServicePrintOnOrder,
    settings.billingPrinter.selfServiceBillWithHandoff,
    settings.billingPrinter.selfServiceKitchenStationCopy,
  ]);

  const save = (next: OutletPrinterSettings) => {
    setSettings(next);
    if (key) {
      try {
        localStorage.setItem(key, JSON.stringify({ ...next, version: 2 }));
      } catch {
        /* quota / private mode */
      }
    }
  };

  const updateKitchen = (patch: Partial<PrinterConfig>) =>
    save({
      ...settings,
      kitchenPrinter: normalizePrinterConfig({ ...settings.kitchenPrinter, ...patch }),
    });

  const updateBilling = (patch: Partial<PrinterConfig>) => {
    const next = {
      ...settings,
      billingPrinter: normalizePrinterConfig({ ...settings.billingPrinter, ...patch }),
    };
    save(next);
    if (outletId) {
      syncSelfServicePrintToNative(outletId, next.billingPrinter);
    }
  };

  const resetToDefaults = () => {
    if (key) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    }
    setSettings(DEFAULT_SETTINGS);
  };

  return { settings, updateKitchen, updateBilling, resetToDefaults };
}

export function escPosOptionsFromPrinterConfig(config: PrinterConfig): EscPosPrintOptions {
  return {
    postPrintFeedLines: config.postPrintFeedLines,
    showTearCutLine: config.showTearCutLine,
    dualKitchenCopies: config.dualKitchenCopies,
    dualBillingCopies: config.dualBillingCopies,
    columnOffset: config.columnOffset,
    amountColumnWidth: config.amountColumnWidth,
    boldTotalLine: config.boldTotalLine,
  };
}

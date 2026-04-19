import { useState, useEffect } from "react";

export type PrinterConnectionType = "bluetooth" | "usb" | "none";

export type PrintMode = "serial" | "browser";

export interface PrinterConfig {
  name: string;
  connectionType: PrinterConnectionType;
  paperWidth: 58 | 80;
  autoPrint: boolean;
  fontSize: number;        // pt — body text size for window.print() fallback
  baudRate: 9600 | 19200 | 38400 | 115200;
  printMode: PrintMode;    // "serial" = Web Serial COM port; "browser" = window.print() dialog
  lastTestedAt?: string;   // ISO timestamp, set when test print runs
  usbPortIndex: number | null; // index into navigator.serial.getPorts(); null = not assigned
}

export interface OutletPrinterSettings {
  kitchenPrinter: PrinterConfig;
  billingPrinter: PrinterConfig;
  version: 1;
}

const DEFAULT_PRINTER: PrinterConfig = {
  name: "",
  connectionType: "none",
  paperWidth: 58,
  autoPrint: false,
  fontSize: 12,
  baudRate: 9600,
  printMode: "browser",
  usbPortIndex: null,
};

const DEFAULT_SETTINGS: OutletPrinterSettings = {
  kitchenPrinter: { ...DEFAULT_PRINTER },
  billingPrinter: { ...DEFAULT_PRINTER },
  version: 1,
};

function normalizePrinterConfig(raw?: Partial<PrinterConfig>): PrinterConfig {
  const merged: PrinterConfig = { ...DEFAULT_PRINTER, ...raw };

  // Backward-compat: older builds stored usbPortIndex from Connected Printers
  // but left printMode as browser, so both jobs went through window.print().
  if (
    merged.usbPortIndex !== null &&
    merged.printMode === "browser" &&
    merged.connectionType === "none"
  ) {
    merged.printMode = "serial";
    merged.connectionType = "usb";
  }

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

  const save = (next: OutletPrinterSettings) => {
    setSettings(next);
    if (key) {
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // localStorage unavailable (private browsing, quota exceeded)
      }
    }
  };

  const updateKitchen = (patch: Partial<PrinterConfig>) =>
    save({ ...settings, kitchenPrinter: { ...settings.kitchenPrinter, ...patch } });

  const updateBilling = (patch: Partial<PrinterConfig>) =>
    save({ ...settings, billingPrinter: { ...settings.billingPrinter, ...patch } });

  const resetToDefaults = () => {
    if (key) {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
    }
    setSettings(DEFAULT_SETTINGS);
  };

  return { settings, updateKitchen, updateBilling, resetToDefaults };
}

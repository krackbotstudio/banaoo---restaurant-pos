import { storage } from "../lib/storage";
import {
  DEFAULT_MOBILE_PRINTER_SETTINGS,
  MobilePrinterSettings,
} from "./printer-service";

export const MOBILE_PRINTER_GLOBAL_KEY = "mobile_printer_settings_global";

export function printerStorageKey(outletId: string | null | undefined): string {
  return outletId ? `mobile_printer_settings_${outletId}` : MOBILE_PRINTER_GLOBAL_KEY;
}

function mergeStored(stored: Partial<MobilePrinterSettings> | null | undefined): MobilePrinterSettings {
  return {
    ...DEFAULT_MOBILE_PRINTER_SETTINGS,
    ...stored,
    kitchenPrinter: {
      ...DEFAULT_MOBILE_PRINTER_SETTINGS.kitchenPrinter,
      ...stored?.kitchenPrinter,
    },
    billingPrinter: {
      ...DEFAULT_MOBILE_PRINTER_SETTINGS.billingPrinter,
      ...stored?.billingPrinter,
    },
  };
}

export async function loadPrinterSettingsByKey(key: string): Promise<MobilePrinterSettings> {
  const stored = await storage.getItem<MobilePrinterSettings>(key);
  return mergeStored(stored);
}

export async function loadEffectivePrinterSettings(outletId?: string | null): Promise<MobilePrinterSettings> {
  if (outletId) {
    const outletKey = printerStorageKey(outletId);
    const outletStored = await storage.getItem<MobilePrinterSettings>(outletKey);
    if (outletStored) return mergeStored(outletStored);
  }

  const globalStored = await storage.getItem<MobilePrinterSettings>(MOBILE_PRINTER_GLOBAL_KEY);
  return mergeStored(globalStored);
}

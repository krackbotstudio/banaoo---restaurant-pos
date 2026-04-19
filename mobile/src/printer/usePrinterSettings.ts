import { useEffect, useState } from "react";
import { storage } from "../lib/storage";
import {
  DEFAULT_MOBILE_PRINTER_SETTINGS,
  MobilePrinterSettings,
} from "./printer-service";

function settingsKey(outletId: string | null | undefined) {
  return outletId ? `mobile_printer_settings_${outletId}` : null;
}

export function usePrinterSettings(outletId: string | null | undefined) {
  const [settings, setSettings] = useState<MobilePrinterSettings>(DEFAULT_MOBILE_PRINTER_SETTINGS);
  const key = settingsKey(outletId);

  useEffect(() => {
    const load = async () => {
      if (!key) {
        setSettings(DEFAULT_MOBILE_PRINTER_SETTINGS);
        return;
      }
      const stored = await storage.getItem<MobilePrinterSettings>(key);
      setSettings({
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
      });
    };
    void load();
  }, [key]);

  const save = async (next: MobilePrinterSettings) => {
    setSettings(next);
    if (key) {
      await storage.setItem(key, { ...next, updatedAt: new Date().toISOString() });
    }
  };

  const updateKitchen = async (
    patch: Partial<MobilePrinterSettings["kitchenPrinter"]>
  ): Promise<void> => {
    const next: MobilePrinterSettings = {
      ...settings,
      kitchenPrinter: { ...settings.kitchenPrinter, ...patch },
    };
    await save(next);
  };

  const updateBilling = async (
    patch: Partial<MobilePrinterSettings["billingPrinter"]>
  ): Promise<void> => {
    const next: MobilePrinterSettings = {
      ...settings,
      billingPrinter: { ...settings.billingPrinter, ...patch },
    };
    await save(next);
  };

  return { settings, updateKitchen, updateBilling };
}

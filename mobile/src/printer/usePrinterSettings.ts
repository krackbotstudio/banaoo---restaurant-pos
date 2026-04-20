import { useEffect, useState } from "react";
import { storage } from "../lib/storage";
import {
  DEFAULT_MOBILE_PRINTER_SETTINGS,
  MobilePrinterSettings,
} from "./printer-service";
import { loadPrinterSettingsByKey, printerStorageKey } from "./printer-storage";

export function usePrinterSettings(outletId: string | null | undefined) {
  const [settings, setSettings] = useState<MobilePrinterSettings>(DEFAULT_MOBILE_PRINTER_SETTINGS);
  const key = printerStorageKey(outletId);

  useEffect(() => {
    const load = async () => {
      const loaded = await loadPrinterSettingsByKey(key);
      setSettings(loaded);
    };
    void load();
  }, [key]);

  const save = async (next: MobilePrinterSettings) => {
    setSettings(next);
    await storage.setItem(key, { ...next, updatedAt: new Date().toISOString() });
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

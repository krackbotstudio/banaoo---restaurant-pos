import { storage } from "../lib/storage";
import {
  DEFAULT_MOBILE_PRINTER_SETTINGS,
  MobilePrinterSettings,
  normalizeRolePrinter,
  type RolePrinterConfig,
} from "./printer-service";

export const MOBILE_PRINTER_GLOBAL_KEY = "mobile_printer_settings_global";

export function printerStorageKey(outletId: string | null | undefined): string {
  return outletId ? `mobile_printer_settings_${outletId}` : MOBILE_PRINTER_GLOBAL_KEY;
}

function mergeStored(stored: Partial<MobilePrinterSettings> | null | undefined): MobilePrinterSettings {
  const merged: MobilePrinterSettings = {
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
  return {
    ...merged,
    kitchenPrinter: normalizeRolePrinter(merged.kitchenPrinter),
    billingPrinter: normalizeRolePrinter(merged.billingPrinter),
  };
}

function normalizeTransport(config: RolePrinterConfig): string {
  if (config.transport === "bluetooth") return "bluetooth-ble";
  return config.transport;
}

/** True when role has enough config to attempt a silent print. */
export function roleIsPrintReady(config: RolePrinterConfig): boolean {
  if (!config.enabled) return false;
  const transport = normalizeTransport(config);
  if (transport === "network") {
    return !!(config.networkHost?.trim() || config.connectionId?.trim());
  }
  if (!config.connectionId?.trim()) return false;
  if (transport === "bluetooth-ble") {
    return !!(config.serviceUUID?.trim() && config.characteristicUUID?.trim());
  }
  return true;
}

function connectionFieldsFrom(source: RolePrinterConfig): Partial<RolePrinterConfig> {
  return {
    enabled: source.enabled,
    name: source.name,
    transport: source.transport,
    connectionId: source.connectionId,
    serviceUUID: source.serviceUUID,
    characteristicUUID: source.characteristicUUID,
    networkHost: source.networkHost,
    networkPort: source.networkPort,
    mode: source.mode,
    paperWidth: source.paperWidth,
    paperWidthPreset: source.paperWidthPreset,
    paperWidthMm: source.paperWidthMm,
    paperColumns: source.paperColumns,
    fontSize: source.fontSize,
    postPrintFeedLines: source.postPrintFeedLines,
    showTearCutLine: source.showTearCutLine,
    dualKitchenCopies: source.dualKitchenCopies,
    dualBillingCopies: source.dualBillingCopies,
    columnOffset: source.columnOffset,
    amountColumnWidth: source.amountColumnWidth,
    boldTotalLine: source.boldTotalLine,
  };
}

/** Prefer outlet role; fall back to global connection when outlet is not print-ready. */
function mergeRoleWithGlobalFallback(
  outletRole: RolePrinterConfig,
  globalRole: RolePrinterConfig
): RolePrinterConfig {
  if (roleIsPrintReady(outletRole)) return outletRole;
  if (!roleIsPrintReady(globalRole)) return outletRole;
  return normalizeRolePrinter({
    ...outletRole,
    ...connectionFieldsFrom(globalRole),
  });
}

export async function loadPrinterSettingsByKey(key: string): Promise<MobilePrinterSettings> {
  const stored = await storage.getItem<MobilePrinterSettings>(key);
  return mergeStored(stored);
}

export async function loadEffectivePrinterSettings(outletId?: string | null): Promise<MobilePrinterSettings> {
  const global = await loadPrinterSettingsByKey(MOBILE_PRINTER_GLOBAL_KEY);

  if (!outletId) {
    return global;
  }

  const outletKey = printerStorageKey(outletId);
  const outletStored = await storage.getItem<MobilePrinterSettings>(outletKey);
  if (!outletStored) {
    return global;
  }

  const outlet = mergeStored(outletStored);
  return {
    ...outlet,
    kitchenPrinter: mergeRoleWithGlobalFallback(outlet.kitchenPrinter, global.kitchenPrinter),
    billingPrinter: mergeRoleWithGlobalFallback(outlet.billingPrinter, global.billingPrinter),
  };
}

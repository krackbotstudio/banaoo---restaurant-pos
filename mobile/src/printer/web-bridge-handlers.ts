import { storage } from "../lib/storage";
import { scanBluetoothPrinters } from "./bluetooth-ble-adapter";
import { getPairedClassicPrinters } from "./bluetooth-classic-adapter";
import type { MobilePrinterSettings, PrinterTransport, RolePrinterConfig } from "./printer-service";
import { loadPrinterSettingsByKey, printerStorageKey } from "./printer-storage";

export interface WebSyncPrinterPayload {
  outletId: string;
  role: "kitchen" | "billing";
  name: string;
  transport: PrinterTransport;
  connectionId: string;
  networkHost?: string;
  networkPort?: number;
  serviceUUID?: string;
  characteristicUUID?: string;
  enabled?: boolean;
}

function applyRolePatch(
  settings: MobilePrinterSettings,
  role: "kitchen" | "billing",
  patch: Partial<RolePrinterConfig>
): MobilePrinterSettings {
  const key = role === "kitchen" ? "kitchenPrinter" : "billingPrinter";
  return {
    ...settings,
    [key]: { ...settings[key], ...patch },
  };
}

export async function handleWebSyncSelfServiceSettings(payload: {
  outletId: string;
  selfServicePrintOnOrder?: boolean;
  selfServiceBillWithHandoff?: boolean;
  selfServiceKitchenStationCopy?: boolean;
}): Promise<void> {
  const key = printerStorageKey(payload.outletId);
  const settings = await loadPrinterSettingsByKey(key);
  const patch: Partial<RolePrinterConfig> = {};
  if (typeof payload.selfServicePrintOnOrder === "boolean") {
    patch.selfServicePrintOnOrder = payload.selfServicePrintOnOrder;
  }
  if (typeof payload.selfServiceBillWithHandoff === "boolean") {
    patch.selfServiceBillWithHandoff = payload.selfServiceBillWithHandoff;
  }
  if (typeof payload.selfServiceKitchenStationCopy === "boolean") {
    patch.selfServiceKitchenStationCopy = payload.selfServiceKitchenStationCopy;
  }
  const next = applyRolePatch(settings, "billing", patch);
  await storage.setItem(key, { ...next, updatedAt: new Date().toISOString() });
}

export async function handleWebSyncPrinter(payload: WebSyncPrinterPayload): Promise<void> {
  const key = printerStorageKey(payload.outletId);
  const settings = await loadPrinterSettingsByKey(key);
  const patch: Partial<RolePrinterConfig> = {
    enabled: payload.enabled ?? true,
    name: payload.name,
    transport: payload.transport,
    connectionId: payload.connectionId,
    networkHost: payload.networkHost ?? "",
    networkPort: payload.networkPort ?? 9100,
    serviceUUID: payload.serviceUUID ?? "",
    characteristicUUID: payload.characteristicUUID ?? "",
  };
  const next = applyRolePatch(settings, payload.role, patch);
  await storage.setItem(key, { ...next, updatedAt: new Date().toISOString() });
}

export async function scanBluetoothForWeb(mode: "ble" | "classic"): Promise<Array<{ id: string; name: string }>> {
  if (mode === "ble") {
    const list = await scanBluetoothPrinters();
    return list.map((d) => ({ id: d.id, name: d.name }));
  }
  const list = await getPairedClassicPrinters();
  return list.map((d) => ({ id: d.id, name: d.name }));
}

export function buildBluetoothScanInjectScript(
  devices: Array<{ id: string; name: string }>,
  error?: string
): string {
  const detail = JSON.stringify({ devices, error: error ?? undefined });
  return `(function(){try{var d=${detail};window.dispatchEvent(new CustomEvent('banaoo-bt-scan-result',{detail:d}));}catch(e){}})();true;`;
}

export function buildPrintResultInjectScript(result: {
  requestId: string;
  ok: boolean;
  message?: string;
}): string {
  const detail = JSON.stringify(result);
  return `(function(){try{var d=${detail};window.dispatchEvent(new CustomEvent('banaoo-native-print-result',{detail:d}));}catch(e){}})();true;`;
}

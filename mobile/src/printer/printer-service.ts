import { Platform } from "react-native";
import {
  BillingReceiptPayload,
  buildBillingReceipt,
  buildKitchenSlip,
  KitchenSlipPayload,
} from "./escpos";
import { printViaBle } from "./bluetooth-ble-adapter";

export type PrinterTransport = "bluetooth" | "network";
export type PrinterMode = "silent" | "dialog";

export interface RolePrinterConfig {
  enabled: boolean;
  name: string;
  connectionId: string;
  serviceUUID: string;
  characteristicUUID: string;
  transport: PrinterTransport;
  paperWidth: 58 | 80;
  mode: PrinterMode;
}

export interface MobilePrinterSettings {
  kitchenPrinter: RolePrinterConfig;
  billingPrinter: RolePrinterConfig;
  updatedAt?: string;
}

export interface PrintCapability {
  platform: "android" | "ios" | "other";
  supportsSilentBluetooth: boolean;
  supportsDialogFallback: boolean;
  message: string;
}

export interface PrintResult {
  ok: boolean;
  modeUsed: PrinterMode;
  message: string;
}

export function getPrintCapability(): PrintCapability {
  if (Platform.OS === "android") {
    return {
      platform: "android",
      supportsSilentBluetooth: true,
      supportsDialogFallback: true,
      message: "Android can support silent Bluetooth printing with native adapter integration.",
    };
  }

  if (Platform.OS === "ios") {
    return {
      platform: "ios",
      supportsSilentBluetooth: false,
      supportsDialogFallback: true,
      message: "iOS usually needs print dialog fallback for generic ESC/POS Bluetooth printers.",
    };
  }

  return {
    platform: "other",
    supportsSilentBluetooth: false,
    supportsDialogFallback: true,
    message: "Current platform supports dialog-style printing fallback only.",
  };
}

export const DEFAULT_ROLE_PRINTER: RolePrinterConfig = {
  enabled: false,
  name: "",
  connectionId: "",
  serviceUUID: "",
  characteristicUUID: "",
  transport: "bluetooth",
  paperWidth: 58,
  mode: "silent",
};

export const DEFAULT_MOBILE_PRINTER_SETTINGS: MobilePrinterSettings = {
  kitchenPrinter: { ...DEFAULT_ROLE_PRINTER },
  billingPrinter: { ...DEFAULT_ROLE_PRINTER },
};

function validatePrinterConfig(config: RolePrinterConfig): string | null {
  if (!config.enabled) return null;
  if (!config.name.trim()) return "Printer name is required";
  if (config.mode === "silent") {
    if (!config.connectionId.trim()) return "Connection id/device identifier is required";
    if (!config.serviceUUID.trim()) return "BLE service UUID is required";
    if (!config.characteristicUUID.trim()) return "BLE characteristic UUID is required";
  }
  return null;
}

async function executePrint(
  role: "kitchen" | "billing",
  config: RolePrinterConfig,
  capability: PrintCapability,
  payload: Uint8Array
): Promise<PrintResult> {
  const validationError = validatePrinterConfig(config);
  if (validationError) {
    return { ok: false, modeUsed: config.mode, message: `${role} printer: ${validationError}` };
  }

  const requestedMode = config.mode;
  if (requestedMode === "silent" && !capability.supportsSilentBluetooth) {
    if (!capability.supportsDialogFallback) {
      return {
        ok: false,
        modeUsed: "silent",
        message: `${role} printer cannot print silently on this device.`,
      };
    }
    return {
      ok: true,
      modeUsed: "dialog",
      message: `${role} print requires system print dialog on this device.`,
    };
  }

  if (requestedMode === "silent") {
    try {
      await printViaBle({
        deviceId: config.connectionId,
        serviceUUID: config.serviceUUID,
        characteristicUUID: config.characteristicUUID,
        payload,
      });
    } catch (err) {
      return {
        ok: false,
        modeUsed: "silent",
        message: `${role} BLE print failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  return {
    ok: true,
    modeUsed: requestedMode,
    message:
      requestedMode === "silent"
        ? `${role} print sent to ${config.name} (${config.connectionId}).`
        : `${role} print opened via system print dialog.`,
  };
}

export async function printKitchenSlip(
  settings: MobilePrinterSettings,
  data: KitchenSlipPayload
): Promise<PrintResult> {
  const capability = getPrintCapability();
  const payload = buildKitchenSlip(data, settings.kitchenPrinter.paperWidth);
  return executePrint("kitchen", settings.kitchenPrinter, capability, payload);
}

export async function printBillingReceipt(
  settings: MobilePrinterSettings,
  data: BillingReceiptPayload
): Promise<PrintResult> {
  const capability = getPrintCapability();
  const payload = buildBillingReceipt(data, settings.billingPrinter.paperWidth);
  return executePrint("billing", settings.billingPrinter, capability, payload);
}

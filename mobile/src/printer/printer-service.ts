import { Platform } from "react-native";
import {
  BillingReceiptPayload,
  buildBillingReceipt,
  buildKitchenSlip,
  EscPosPrintOptions,
  KitchenSlipPayload,
} from "./escpos";
import { printViaBle } from "./bluetooth-ble-adapter";
import { printViaClassic } from "./bluetooth-classic-adapter";

export type PrinterTransport = "bluetooth" | "bluetooth-ble" | "bluetooth-classic" | "network";
export type PrinterMode = "silent" | "dialog";

export interface RolePrinterConfig {
  enabled: boolean;
  name: string;
  connectionId: string;
  serviceUUID: string;
  characteristicUUID: string;
  transport: PrinterTransport;
  paperWidth: 58 | 80;
  fontSize: number;
  mode: PrinterMode;
  postPrintFeedLines: number;
  showTearCutLine: boolean;
  dualKitchenCopies: boolean;
  dualBillingCopies: boolean;
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
  transport: "bluetooth-classic",
  paperWidth: 58,
  fontSize: 12,
  mode: "silent",
  postPrintFeedLines: 4,
  showTearCutLine: true,
  dualKitchenCopies: false,
  dualBillingCopies: false,
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
    const normalizedTransport = config.transport === "bluetooth" ? "bluetooth-ble" : config.transport;
    if (normalizedTransport === "bluetooth-ble") {
      if (!config.serviceUUID.trim()) return "BLE service UUID is required";
      if (!config.characteristicUUID.trim()) return "BLE characteristic UUID is required";
    }
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
      const normalizedTransport = config.transport === "bluetooth" ? "bluetooth-ble" : config.transport;
      if (normalizedTransport === "bluetooth-ble") {
        await printViaBle({
          deviceId: config.connectionId,
          serviceUUID: config.serviceUUID,
          characteristicUUID: config.characteristicUUID,
          payload,
        });
      } else if (normalizedTransport === "bluetooth-classic") {
        await printViaClassic({
          deviceId: config.connectionId,
          payload,
        });
      } else {
        return {
          ok: false,
          modeUsed: "silent",
          message: `${role} transport ${normalizedTransport} is not supported for silent print.`,
        };
      }
    } catch (err) {
      return {
        ok: false,
        modeUsed: "silent",
        message: `${role} print failed: ${err instanceof Error ? err.message : String(err)}`,
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

function escPosOptionsFromRole(config: RolePrinterConfig): EscPosPrintOptions {
  return {
    postPrintFeedLines: config.postPrintFeedLines,
    showTearCutLine: config.showTearCutLine,
    dualKitchenCopies: config.dualKitchenCopies,
    dualBillingCopies: config.dualBillingCopies,
  };
}

export async function printKitchenSlip(
  settings: MobilePrinterSettings,
  data: KitchenSlipPayload
): Promise<PrintResult> {
  const capability = getPrintCapability();
  const payload = buildKitchenSlip(
    data,
    settings.kitchenPrinter.paperWidth,
    settings.kitchenPrinter.fontSize,
    escPosOptionsFromRole(settings.kitchenPrinter)
  );
  return executePrint("kitchen", settings.kitchenPrinter, capability, payload);
}

export async function printBillingReceipt(
  settings: MobilePrinterSettings,
  data: BillingReceiptPayload
): Promise<PrintResult> {
  const capability = getPrintCapability();
  const payload = buildBillingReceipt(
    data,
    settings.billingPrinter.paperWidth,
    settings.billingPrinter.fontSize,
    escPosOptionsFromRole(settings.billingPrinter)
  );
  return executePrint("billing", settings.billingPrinter, capability, payload);
}

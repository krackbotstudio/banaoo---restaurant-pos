import { Platform } from "react-native";
import {
  BillingReceiptPayload,
  buildBillingReceipt,
  buildCalibrationSlip,
  buildCustomerTokenSlip,
  buildKitchenCancelSlip,
  buildKitchenSlip,
  CustomerTokenSlipPayload,
  EscPosPrintOptions,
  KitchenSlipPayload,
} from "./escpos";
import {
  getPrintLayoutFromConfig,
  paperLayoutToStorage,
  type PaperWidthPresetId,
} from "./paper-width";
import { printViaBle } from "./bluetooth-ble-adapter";
import { printViaClassic } from "./bluetooth-classic-adapter";
import { printViaNetwork } from "./network-tcp-adapter";

export type PrinterTransport = "bluetooth" | "bluetooth-ble" | "bluetooth-classic" | "network";
export type PrinterMode = "silent" | "dialog";

export interface RolePrinterConfig {
  enabled: boolean;
  name: string;
  connectionId: string;
  serviceUUID: string;
  characteristicUUID: string;
  transport: PrinterTransport;
  /** LAN / Wi‑Fi printer IP (also mirrored in connectionId for legacy rows) */
  networkHost: string;
  networkPort: number;
  paperWidth: 58 | 80;
  paperWidthPreset: PaperWidthPresetId;
  paperWidthMm: number;
  paperColumns: number;
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
  supportsSilentNetwork: boolean;
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
      supportsSilentNetwork: true,
      supportsDialogFallback: true,
      message: "Android supports Bluetooth and Wi‑Fi/LAN (IP:9100) silent printing.",
    };
  }

  if (Platform.OS === "ios") {
    return {
      platform: "ios",
      supportsSilentBluetooth: false,
      supportsSilentNetwork: false,
      supportsDialogFallback: true,
      message: "iOS may require print dialog fallback for some printers.",
    };
  }

  return {
    platform: "other",
    supportsSilentBluetooth: false,
    supportsSilentNetwork: false,
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
  networkHost: "",
  networkPort: 9100,
  paperWidth: 58,
  paperWidthPreset: "58",
  paperWidthMm: 58,
  paperColumns: 32,
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

export function normalizeRolePrinter(config: RolePrinterConfig): RolePrinterConfig {
  const { layout } = getPrintLayoutFromConfig(config);
  const stored = paperLayoutToStorage(layout);
  return {
    ...config,
    ...stored,
    paperWidthPreset: stored.paperWidthPreset ?? config.paperWidthPreset ?? "58",
    paperWidthMm: stored.paperWidthMm ?? config.paperWidthMm ?? 58,
    paperColumns: stored.paperColumns ?? config.paperColumns ?? 32,
  };
}

function normalizeTransport(config: RolePrinterConfig): PrinterTransport {
  if (config.transport === "bluetooth") return "bluetooth-ble";
  return config.transport;
}

function resolveNetworkHost(config: RolePrinterConfig): string {
  return (config.networkHost || config.connectionId || "").trim();
}

function resolveNetworkPort(config: RolePrinterConfig): number {
  const p = config.networkPort;
  return typeof p === "number" && p > 0 ? p : 9100;
}

function validatePrinterConfig(config: RolePrinterConfig): string | null {
  if (!config.enabled) return null;
  if (!config.name.trim()) return "Printer name is required";

  if (config.mode !== "silent") return null;

  const transport = normalizeTransport(config);

  if (transport === "network") {
    if (!resolveNetworkHost(config)) return "Printer IP address is required for Wi‑Fi/LAN";
    return null;
  }

  if (!config.connectionId.trim()) return "Connection id/device identifier is required";

  if (transport === "bluetooth-ble") {
    if (!config.serviceUUID.trim()) return "BLE service UUID is required";
    if (!config.characteristicUUID.trim()) return "BLE characteristic UUID is required";
  }

  return null;
}

function canSilentPrint(transport: PrinterTransport, capability: PrintCapability): boolean {
  if (transport === "network") return capability.supportsSilentNetwork;
  return capability.supportsSilentBluetooth;
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

  if (!config.enabled) {
    return { ok: false, modeUsed: config.mode, message: `${role} printer is disabled` };
  }

  const transport = normalizeTransport(config);
  const requestedMode = config.mode;

  if (requestedMode === "silent" && !canSilentPrint(transport, capability)) {
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
      if (transport === "network") {
        await printViaNetwork({
          host: resolveNetworkHost(config),
          port: resolveNetworkPort(config),
          payload,
        });
      } else if (transport === "bluetooth-ble") {
        await printViaBle({
          deviceId: config.connectionId,
          serviceUUID: config.serviceUUID,
          characteristicUUID: config.characteristicUUID,
          payload,
        });
      } else if (transport === "bluetooth-classic") {
        await printViaClassic({
          deviceId: config.connectionId,
          payload,
        });
      } else {
        return {
          ok: false,
          modeUsed: "silent",
          message: `${role} transport ${transport} is not supported.`,
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

  const target =
    transport === "network"
      ? `${resolveNetworkHost(config)}:${resolveNetworkPort(config)}`
      : config.connectionId;

  return {
    ok: true,
    modeUsed: requestedMode,
    message:
      requestedMode === "silent"
        ? `${role} print sent to ${config.name} (${target}).`
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
  const { layout, fontSize } = getPrintLayoutFromConfig(settings.kitchenPrinter);
  const payload = buildKitchenSlip(
    data,
    layout,
    fontSize,
    escPosOptionsFromRole(settings.kitchenPrinter)
  );
  return executePrint("kitchen", settings.kitchenPrinter, capability, payload);
}

export async function printKitchenCancelSlip(
  settings: MobilePrinterSettings,
  data: KitchenSlipPayload,
  cancelledAt?: Date
): Promise<PrintResult> {
  const capability = getPrintCapability();
  const { layout, fontSize } = getPrintLayoutFromConfig(settings.kitchenPrinter);
  const payload = buildKitchenCancelSlip(
    data,
    layout,
    fontSize,
    escPosOptionsFromRole(settings.kitchenPrinter),
    cancelledAt
  );
  return executePrint("kitchen", settings.kitchenPrinter, capability, payload);
}

export async function printCustomerTokenSlip(
  settings: MobilePrinterSettings,
  data: CustomerTokenSlipPayload
): Promise<PrintResult> {
  const capability = getPrintCapability();
  const { layout, fontSize } = getPrintLayoutFromConfig(settings.billingPrinter);
  const payload = buildCustomerTokenSlip(
    data,
    layout,
    fontSize,
    {
      postPrintFeedLines: settings.billingPrinter.postPrintFeedLines,
      showTearCutLine: settings.billingPrinter.showTearCutLine,
    }
  );
  return executePrint("billing", settings.billingPrinter, capability, payload);
}

export async function printBillingReceipt(
  settings: MobilePrinterSettings,
  data: BillingReceiptPayload
): Promise<PrintResult> {
  const capability = getPrintCapability();
  const { layout, fontSize } = getPrintLayoutFromConfig(settings.billingPrinter);
  const payload = buildBillingReceipt(
    data,
    layout,
    fontSize,
    escPosOptionsFromRole(settings.billingPrinter)
  );
  return executePrint("billing", settings.billingPrinter, capability, payload);
}

export function applyRuntimePaperFromPayload(
  settings: MobilePrinterSettings,
  role: "kitchen" | "billing",
  payload: Record<string, unknown>
): MobilePrinterSettings {
  const patch: Partial<RolePrinterConfig> = {};
  if (typeof payload.paperWidthMm === "number" && Number.isFinite(payload.paperWidthMm)) {
    const mm = Math.round(payload.paperWidthMm);
    patch.paperWidthMm = mm;
    patch.paperWidthPreset = "custom";
    if (typeof payload.paperColumns === "number" && Number.isFinite(payload.paperColumns)) {
      patch.paperColumns = Math.round(payload.paperColumns);
    }
    patch.paperWidth = mm <= 60 ? 58 : 80;
  } else if (payload.paperWidth === 80 || payload.paperWidth === 58) {
    patch.paperWidth = payload.paperWidth;
  }
  if (Object.keys(patch).length === 0) return settings;
  if (role === "kitchen") {
    return {
      ...settings,
      kitchenPrinter: normalizeRolePrinter({ ...settings.kitchenPrinter, ...patch }),
    };
  }
  return {
    ...settings,
    billingPrinter: normalizeRolePrinter({ ...settings.billingPrinter, ...patch }),
  };
}

export async function printCalibrationSlip(
  role: "kitchen" | "billing",
  settings: MobilePrinterSettings
): Promise<PrintResult> {
  const capability = getPrintCapability();
  const config = role === "kitchen" ? settings.kitchenPrinter : settings.billingPrinter;
  const { layout, fontSize } = getPrintLayoutFromConfig(config);
  const payload = buildCalibrationSlip(layout, fontSize, escPosOptionsFromRole(config));
  return executePrint(role, config, capability, payload);
}

export async function testKitchenPrint(settings: MobilePrinterSettings): Promise<PrintResult> {
  return printKitchenSlip(settings, {
    orderNumber: "TEST",
    orderType: "dine_in",
    tableNumber: "1",
    items: [{ name: "Test Item", quantity: 1 }],
    createdAt: new Date(),
  });
}

export async function testBillingPrint(settings: MobilePrinterSettings): Promise<PrintResult> {
  return printBillingReceipt(settings, {
    orderNumber: "TEST",
    outletName: settings.billingPrinter.name || "Banaoo",
    orderType: "dine_in",
    items: [{ name: "Test Item", quantity: 1, totalPrice: 100, gstRate: 5 }],
    subtotal: 100,
    discountAmt: 0,
    serviceTax: 0,
    serviceTaxPercent: 0,
    gstTotal: 5,
    grandTotal: 105,
    createdAt: new Date(),
  });
}

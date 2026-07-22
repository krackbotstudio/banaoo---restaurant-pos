import {
  buildCustomerTokenSlip,
  printViaSerial,
  type CustomerTokenSlipData,
} from "@/lib/serial-printer";
import {
  isNativePrinterBridgeExpected,
  isNativePrintCapable,
  openNativePrinterSettings,
  postNativeCustomerTokenPrint,
} from "@/lib/native-print-bridge";
import type { OutletPrinterSettings } from "@/lib/use-printer-settings";
import { getPrintLayoutFromConfig, legacyPaperWidthMm } from "@/lib/paper-width";

export type CustomerTokenPrintResult = { ok: true } | { ok: false; message: string };

export interface CustomerTokenPrintInput {
  outletId?: string | null;
  outletName?: string;
  orderNumber: string;
  orderType: "dine_in" | "takeaway";
  tableNumber?: string;
  items: { name: string; quantity: number }[];
  total: number;
  createdAt: Date;
  source?: string;
}

function escPosOptions(settings: OutletPrinterSettings) {
  const b = settings.billingPrinter;
  return {
    postPrintFeedLines: b.postPrintFeedLines,
    showTearCutLine: b.showTearCutLine,
  };
}

export async function printCustomerTokenSlip(
  settings: OutletPrinterSettings,
  input: CustomerTokenPrintInput
): Promise<CustomerTokenPrintResult> {
  const slipData: CustomerTokenSlipData = {
    orderNumber: input.orderNumber,
    outletName: input.outletName,
    orderType: input.orderType,
    tableNumber: input.tableNumber,
    items: input.items,
    total: input.total,
    createdAt: input.createdAt,
    source: input.source,
  };

  const posted = await postNativeCustomerTokenPrint({
    outletId: input.outletId,
    paperWidth: legacyPaperWidthMm(settings.billingPrinter.paperWidthMm),
    paperWidthMm: settings.billingPrinter.paperWidthMm,
    orderNumber: input.orderNumber,
    outletName: input.outletName ?? "",
    orderType: input.orderType,
    tableNumber: input.tableNumber,
    items: input.items,
    total: input.total,
    createdAt: input.createdAt.toISOString(),
    source: input.source,
  });
  if (isNativePrintCapable()) {
    return posted.ok ? { ok: true } : { ok: false, message: posted.message ?? "Customer token print failed" };
  }

  if (isNativePrinterBridgeExpected()) {
    return { ok: false, message: "Native printer bridge unavailable" };
  }

  const b = settings.billingPrinter;

  if (b.transport === "network") {
    return {
      ok: false,
      message:
        "Wi‑Fi/LAN printing must be configured in the Flaze Android app (Settings → Printers → Native printer settings).",
    };
  }

  const portIndex = b.usbPortIndex;
  const useSerial =
    b.transport === "usb" ||
    b.transport === "bluetooth" ||
    b.printMode === "serial" ||
    portIndex !== null;

  if (useSerial) {
    if (portIndex === null) {
      return {
        ok: false,
        message: "No billing printer port assigned — open Settings → Printers.",
      };
    }
    try {
      const { layout, fontSize } = getPrintLayoutFromConfig(b);
      const bytes = buildCustomerTokenSlip(slipData, layout, fontSize, escPosOptions(settings));
      await printViaSerial(portIndex, bytes, b.baudRate);
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, message: msg };
    }
  }

  return { ok: false, message: "Assign a billing printer in Settings → Printers for customer tokens." };
}

export function openBillingPrinterSettingsIfNeeded(): void {
  if (isNativePrinterBridgeExpected()) {
    openNativePrinterSettings();
  }
}

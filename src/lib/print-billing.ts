import {
  buildBillingReceipt,
  printViaSerial,
  type BillingReceiptData,
} from "@/lib/serial-printer";
import {
  isNativePrinterBridgeExpected,
  isNativePrintCapable,
  openNativePrinterSettings,
  postNativeBillingPrint,
  type NativeBillingPrintPayload,
} from "@/lib/native-print-bridge";
import type { OutletPrinterSettings } from "@/lib/use-printer-settings";
import { escPosOptionsFromPrinterConfig } from "@/lib/use-printer-settings";
import { getPrintLayoutFromConfig, legacyPaperWidthMm } from "@/lib/paper-width";

export type BillingPrintResult = { ok: boolean; message?: string };

export async function printBillingReceiptWeb(
  settings: OutletPrinterSettings,
  nativePayload: NativeBillingPrintPayload,
  slipData: BillingReceiptData
): Promise<BillingPrintResult> {
  const posted = await postNativeBillingPrint(nativePayload);
  if (isNativePrintCapable()) {
    return posted.ok ? { ok: true } : { ok: false, message: posted.message ?? "Billing print failed" };
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
    b.transport === "usb" || b.transport === "bluetooth" || b.printMode === "serial" || portIndex !== null;

  if (useSerial) {
    if (portIndex === null) {
      return {
        ok: false,
        message: "No printer port assigned — open Settings → Printers and assign a USB or Bluetooth printer.",
      };
    }
    try {
      const { layout, fontSize } = getPrintLayoutFromConfig(b);
      const bytes = buildBillingReceipt(slipData, layout, fontSize, escPosOptionsFromPrinterConfig(b));
      await printViaSerial(portIndex, bytes, b.baudRate);
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, message: msg };
    }
  }

  return { ok: false, message: "Use browser print or assign a serial/USB/Bluetooth printer in Settings." };
}

export function openBillingPrinterSettingsIfNeeded(): void {
  if (isNativePrinterBridgeExpected()) {
    openNativePrinterSettings();
  }
}

import {
  buildBillingReceipt,
  buildSelfServiceBillingReceipt,
  printViaSerial,
  type BillingReceiptData,
} from "@/lib/serial-printer";
import {
  isNativePrinterBridgeExpected,
  openNativePrinterSettings,
  postNativeBillingPrint,
} from "@/lib/native-print-bridge";
import type { OutletPrinterSettings } from "@/lib/use-printer-settings";
import { escPosOptionsFromPrinterConfig } from "@/lib/use-printer-settings";
import { getPrintLayoutFromConfig, legacyPaperWidthMm } from "@/lib/paper-width";
import { printKitchenOrderSlip, type KitchenOrderPrintInput } from "@/lib/print-kitchen";

export type SelfServicePrintResult = {
  ok: boolean;
  billingOk: boolean;
  kitchenOk: boolean;
  message?: string;
};

export interface SelfServicePrintInput extends KitchenOrderPrintInput {
  outletName?: string;
  gstNumber?: string | null;
  subtotal: number;
  discountAmt?: number;
  discountPercent?: number;
  serviceTax?: number;
  serviceTaxPercent?: number;
  gstTotal?: number;
  grandTotal: number;
  items: Array<{
    name: string;
    quantity: number;
    totalPrice: number;
    gstRate?: number;
  }>;
}

function toBillingData(input: SelfServicePrintInput): BillingReceiptData {
  return {
    orderNumber: input.orderNumber,
    outletName: input.outletName ?? "",
    gstNumber: input.gstNumber,
    orderType: input.orderType,
    tableNumber: input.tableNumber,
    items: input.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      totalPrice: i.totalPrice,
      gstRate: i.gstRate,
    })),
    subtotal: input.subtotal,
    discountAmt: input.discountAmt ?? 0,
    discountPercent: input.discountPercent,
    serviceTax: input.serviceTax ?? 0,
    serviceTaxPercent: input.serviceTaxPercent ?? 0,
    gstTotal: input.gstTotal ?? 0,
    grandTotal: input.grandTotal,
    createdAt: input.createdAt,
  };
}

async function printSelfServiceBilling(
  settings: OutletPrinterSettings,
  input: SelfServicePrintInput
): Promise<{ ok: boolean; message?: string }> {
  const b = settings.billingPrinter;
  const slipData = toBillingData(input);
  const { layout, fontSize } = getPrintLayoutFromConfig(b);
  const escOpts = escPosOptionsFromPrinterConfig(b);

  const posted = postNativeBillingPrint({
    outletId: input.outletId,
    paperWidth: legacyPaperWidthMm(layout.paperWidthMm),
    paperWidthMm: layout.paperWidthMm,
    paperColumns: layout.columns,
    orderNumber: input.orderNumber,
    outletName: input.outletName ?? "",
    gstNumber: input.gstNumber,
    orderType: input.orderType,
    tableNumber: input.tableNumber,
    items: slipData.items,
    subtotal: input.subtotal,
    discountAmt: input.discountAmt ?? 0,
    discountPercent: input.discountPercent,
    serviceTax: input.serviceTax ?? 0,
    serviceTaxPercent: input.serviceTaxPercent ?? 0,
    gstTotal: input.gstTotal ?? 0,
    grandTotal: input.grandTotal,
    createdAt: input.createdAt.toISOString(),
    selfServiceHandoff: b.selfServiceBillWithHandoff,
    columnOffset: b.columnOffset,
    amountColumnWidth: b.amountColumnWidth,
    boldTotalLine: b.boldTotalLine,
  });
  if (posted) return { ok: true };

  if (isNativePrinterBridgeExpected()) {
    return { ok: false, message: "Native printer bridge unavailable" };
  }

  if (b.transport === "network") {
    return {
      ok: false,
      message:
        "Wi‑Fi/LAN printing: configure the billing printer in the Banaoo Android app (Native printer settings).",
    };
  }

  const portIndex = b.usbPortIndex;
  const useSerial =
    b.transport === "usb" ||
    b.transport === "bluetooth" ||
    b.printMode === "serial" ||
    portIndex !== null;

  if (!useSerial || portIndex === null) {
    return { ok: false, message: "Assign a billing printer in Settings → Printers." };
  }

  try {
    const bytes = b.selfServiceBillWithHandoff
      ? buildSelfServiceBillingReceipt(slipData, layout, fontSize, escOpts)
      : buildBillingReceipt(slipData, layout, fontSize, escOpts);
    await printViaSerial(portIndex, bytes, b.baudRate);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: msg };
  }
}

/** Self service counter: billing receipt (+ optional kitchen handoff), optional kitchen station copy. */
export async function printSelfServiceOrderSlips(
  settings: OutletPrinterSettings,
  input: SelfServicePrintInput
): Promise<SelfServicePrintResult> {
  const b = settings.billingPrinter;
  let billingOk = true;
  let kitchenOk = true;
  let message: string | undefined;

  if (b.selfServicePrintOnOrder) {
    const billingResult = await printSelfServiceBilling(settings, input);
    billingOk = billingResult.ok;
    if (!billingOk) message = billingResult.message;
  }

  if (b.selfServiceKitchenStationCopy) {
    const kitchenResult = await printKitchenOrderSlip(settings, {
      outletId: input.outletId,
      orderNumber: input.orderNumber,
      orderType: input.orderType,
      tableNumber: input.tableNumber,
      items: input.items.map((i) => ({ name: i.name, quantity: i.quantity })),
      createdAt: input.createdAt,
      source: input.source ?? "pos",
      selfServiceMode: true,
    });
    kitchenOk = kitchenResult.ok;
    if (!kitchenOk) {
      message = message ? `${message}; ${kitchenResult.message}` : kitchenResult.message;
    }
  }

  return { ok: billingOk && kitchenOk, billingOk, kitchenOk, message };
}

export function openSelfServicePrinterSettingsIfNeeded(): void {
  if (isNativePrinterBridgeExpected()) {
    openNativePrinterSettings();
  }
}

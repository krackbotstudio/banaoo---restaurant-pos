import {
  buildKitchenHandoffSlip,
  buildSelfServiceMainBill,
  printViaSerial,
  type BillingReceiptData,
  type KitchenHandoffSlipData,
} from "@/lib/serial-printer";
import {
  isNativePrinterBridgeExpected,
  openNativePrinterSettings,
  postNativeBillingPrint,
  postNativeKitchenHandoffPrint,
  type NativeBillingPrintPayload,
  type NativeKitchenHandoffPrintPayload,
} from "@/lib/native-print-bridge";
import type { OutletPrinterSettings } from "@/lib/use-printer-settings";
import { escPosOptionsFromPrinterConfig } from "@/lib/use-printer-settings";
import { getPrintLayoutFromConfig, legacyPaperWidthMm } from "@/lib/paper-width";
import { printKitchenOrderSlip, type KitchenOrderPrintInput } from "@/lib/print-kitchen";

/** Pause between print jobs so the auto-cutter can finish before the kitchen slip. */
export const SELF_SERVICE_CUT_DELAY_MS = 700;

export type SelfServicePrintResult = {
  ok: boolean;
  billingOk: boolean;
  kitchenHandoffOk: boolean;
  kitchenStationOk: boolean;
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

function toHandoffData(input: SelfServicePrintInput): KitchenHandoffSlipData {
  return {
    orderNumber: input.orderNumber,
    orderType: input.orderType,
    tableNumber: input.tableNumber,
    items: input.items.map((i) => ({ name: i.name, quantity: i.quantity })),
    createdAt: input.createdAt,
  };
}

function layoutPayload(
  settings: OutletPrinterSettings,
  input: SelfServicePrintInput
): Pick<
  NativeBillingPrintPayload,
  "outletId" | "paperWidth" | "paperWidthMm" | "paperColumns" | "columnOffset" | "amountColumnWidth" | "boldTotalLine"
> {
  const b = settings.billingPrinter;
  const { layout } = getPrintLayoutFromConfig(b);
  return {
    outletId: input.outletId,
    paperWidth: legacyPaperWidthMm(layout.paperWidthMm),
    paperWidthMm: layout.paperWidthMm,
    paperColumns: layout.columns,
    columnOffset: b.columnOffset,
    amountColumnWidth: b.amountColumnWidth,
    boldTotalLine: b.boldTotalLine,
  };
}

function billingPrinterReady(settings: OutletPrinterSettings): string | null {
  const b = settings.billingPrinter;
  if (isNativePrinterBridgeExpected()) return null;
  if (b.transport === "network") {
    return "Configure the billing printer in the Banaoo Android app (Native printer settings).";
  }
  const portIndex = b.usbPortIndex;
  const useSerial =
    b.transport === "usb" ||
    b.transport === "bluetooth" ||
    b.printMode === "serial" ||
    portIndex !== null;
  if (!useSerial || portIndex === null) {
    return "Assign a billing printer in Settings → Printers.";
  }
  return null;
}

/** Job 1: full customer bill → printer cut. */
export async function printSelfServiceMainBill(
  settings: OutletPrinterSettings,
  input: SelfServicePrintInput
): Promise<{ ok: boolean; message?: string }> {
  const b = settings.billingPrinter;
  const slipData = toBillingData(input);
  const { layout, fontSize } = getPrintLayoutFromConfig(b);
  const escOpts = escPosOptionsFromPrinterConfig(b);
  const layoutFields = layoutPayload(settings, input);

  const posted = postNativeBillingPrint({
    ...layoutFields,
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
    selfServiceMainBillOnly: true,
  });
  if (posted) return { ok: true };

  const err = billingPrinterReady(settings);
  if (err) return { ok: false, message: err };
  if (isNativePrinterBridgeExpected()) {
    return { ok: false, message: "Native printer bridge unavailable" };
  }

  const portIndex = b.usbPortIndex!;
  try {
    const bytes = buildSelfServiceMainBill(slipData, layout, fontSize, escOpts);
    await printViaSerial(portIndex, bytes, b.baudRate);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg };
  }
}

/** Job 2: kitchen handoff (items + qty) → printer cut. Call only after main bill job completes. */
export async function printSelfServiceKitchenHandoff(
  settings: OutletPrinterSettings,
  input: SelfServicePrintInput
): Promise<{ ok: boolean; message?: string }> {
  const b = settings.billingPrinter;
  const handoff = toHandoffData(input);
  const { layout, fontSize } = getPrintLayoutFromConfig(b);
  const escOpts = escPosOptionsFromPrinterConfig(b);
  const layoutFields = layoutPayload(settings, input);

  const posted = postNativeKitchenHandoffPrint({
    ...layoutFields,
    orderNumber: input.orderNumber,
    orderType: input.orderType,
    tableNumber: input.tableNumber,
    items: handoff.items,
    createdAt: input.createdAt.toISOString(),
  } satisfies NativeKitchenHandoffPrintPayload);
  if (posted) return { ok: true };

  const err = billingPrinterReady(settings);
  if (err) return { ok: false, message: err };
  if (isNativePrinterBridgeExpected()) {
    return { ok: false, message: "Native printer bridge unavailable" };
  }

  const portIndex = b.usbPortIndex!;
  try {
    const bytes = buildKitchenHandoffSlip(handoff, layout, fontSize, escOpts);
    await printViaSerial(portIndex, bytes, b.baudRate);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg };
  }
}

export function delayForPrinterCut(ms = SELF_SERVICE_CUT_DELAY_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Self service: main bill (cut) → pause for cutter → kitchen handoff (cut).
 * Optional third job: kitchen station printer.
 */
export async function printSelfServiceOrderSlips(
  settings: OutletPrinterSettings,
  input: SelfServicePrintInput,
  options?: { printMainBill?: boolean; printKitchenHandoff?: boolean }
): Promise<SelfServicePrintResult> {
  const b = settings.billingPrinter;
  const printMain = options?.printMainBill ?? b.selfServicePrintOnOrder;
  const printHandoff = options?.printKitchenHandoff ?? b.selfServiceBillWithHandoff;

  let billingOk = !printMain;
  let kitchenHandoffOk = !printHandoff;
  let kitchenStationOk = true;
  let message: string | undefined;

  if (printMain) {
    const r = await printSelfServiceMainBill(settings, input);
    billingOk = r.ok;
    if (!billingOk) message = r.message;
  }

  if (printHandoff && billingOk) {
    await delayForPrinterCut();
    const r = await printSelfServiceKitchenHandoff(settings, input);
    kitchenHandoffOk = r.ok;
    if (!kitchenHandoffOk) {
      message = message ? `${message}; ${r.message}` : r.message;
    }
  }

  if (b.selfServiceKitchenStationCopy) {
    const r = await printKitchenOrderSlip(settings, {
      outletId: input.outletId,
      orderNumber: input.orderNumber,
      orderType: input.orderType,
      tableNumber: input.tableNumber,
      items: input.items.map((i) => ({ name: i.name, quantity: i.quantity })),
      createdAt: input.createdAt,
      source: input.source ?? "pos",
      selfServiceMode: true,
    });
    kitchenStationOk = r.ok;
    if (!kitchenStationOk) {
      message = message ? `${message}; ${r.message}` : r.message;
    }
  }

  const ok = billingOk && kitchenHandoffOk && kitchenStationOk;
  return { ok, billingOk, kitchenHandoffOk, kitchenStationOk, message };
}

export function openSelfServicePrinterSettingsIfNeeded(): void {
  if (isNativePrinterBridgeExpected()) {
    openNativePrinterSettings();
  }
}

import {
  buildBillingReceipt,
  buildKitchenCancelSlip,
  buildKitchenHandoffSlip,
  buildKitchenSlip,
  buildCalibrationSlip,
  printViaSerial,
  type KitchenSlipData,
  type KitchenCancelSlipData,
  type BillingReceiptData,
} from "@/lib/serial-printer";
import { getPrintLayoutFromConfig } from "@/lib/paper-width";
import { escPosOptionsFromPrinterConfig } from "@/lib/use-printer-settings";
import {
  isNativePrintCapable,
  postNativeKitchenPrint,
  postNativeKitchenCancelPrint,
  postNativeBillingPrint,
  postNativeKitchenHandoffPrint,
} from "@/lib/native-print-bridge";
import { legacyPaperWidthMm } from "@/lib/paper-width";
import { printerRecordToConfig } from "./legacy-adapter";
import type { PrinterRecord, RoutedPrintBatch, PrintJobType } from "./types";
import { printKitchenBrowser } from "@/lib/print-kitchen";

export type ExecuteResult = { ok: boolean; message?: string };

function kitchenSlipFromBatch(batch: RoutedPrintBatch): KitchenSlipData {
  return {
    orderNumber: batch.meta.orderNumber,
    orderType: batch.meta.orderType,
    tableNumber: batch.meta.tableNumber,
    items: batch.items.map((i) => ({ name: i.name, quantity: i.quantity })),
    createdAt: batch.meta.createdAt,
    source: batch.meta.source,
    selfServiceMode: batch.meta.selfServiceMode,
  };
}

async function executeKitchenSerial(
  printer: PrinterRecord,
  batch: RoutedPrintBatch,
  build: typeof buildKitchenSlip | typeof buildKitchenCancelSlip
): Promise<ExecuteResult> {
  const config = printerRecordToConfig(printer);
  if (config.usbPortIndex === null && config.transport !== "network") {
    return { ok: false, message: `No port assigned for ${printer.name}` };
  }
  try {
    const slip = kitchenSlipFromBatch(batch);
    const { layout, fontSize } = getPrintLayoutFromConfig(config);
    const escOpts = escPosOptionsFromPrinterConfig(config);
    const bytes = build(slip, layout, fontSize, escOpts);
    if (config.usbPortIndex !== null) {
      await printViaSerial(config.usbPortIndex, bytes, config.baudRate);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

async function executeKitchenBatch(batch: RoutedPrintBatch): Promise<ExecuteResult> {
  const printer = batch.printer;
  const config = printerRecordToConfig(printer);
  const slip = kitchenSlipFromBatch(batch);
  const isCancel = batch.jobType === "kot_cancel";

  if (isNativePrintCapable()) {
    const fn = isCancel ? postNativeKitchenCancelPrint : postNativeKitchenPrint;
    const posted = fn({
      outletId: batch.meta.outletId,
      printerId: printer.id,
      paperWidth: legacyPaperWidthMm(config.paperWidthMm),
      paperWidthMm: config.paperWidthMm,
      paperColumns: config.paperColumns,
      orderNumber: batch.meta.orderNumber,
      orderType: batch.meta.orderType,
      tableNumber: batch.meta.tableNumber,
      items: slip.items,
      createdAt: batch.meta.createdAt.toISOString(),
      source: batch.meta.source,
      selfServiceMode: batch.meta.selfServiceMode,
      intent: isCancel ? "cancel" : "order",
    });
    if (posted) return { ok: true };
    return { ok: false, message: "Native printer bridge unavailable" };
  }

  if (config.transport === "network") {
    return {
      ok: false,
      message: `Configure ${printer.name} in the Banaoo Android app (LAN/BT).`,
    };
  }

  const useSerial =
    config.transport === "usb" ||
    config.transport === "bluetooth" ||
    config.printMode === "serial" ||
    config.usbPortIndex !== null;

  if (useSerial) {
    return executeKitchenSerial(
      printer,
      batch,
      isCancel ? buildKitchenCancelSlip : buildKitchenSlip
    );
  }

  const title = batch.meta.selfServiceMode ? "** KITCHEN BILL **" : "** KITCHEN ORDER **";
  const result = printKitchenBrowser(
    {
      outletId: batch.meta.outletId,
      orderNumber: batch.meta.orderNumber,
      orderType: batch.meta.orderType,
      tableNumber: batch.meta.tableNumber,
      items: slip.items,
      createdAt: batch.meta.createdAt,
      source: batch.meta.source,
      selfServiceMode: batch.meta.selfServiceMode,
    },
    config.fontSize,
    config.paperWidthMm,
    title
  );
  return result.ok ? { ok: true } : { ok: false, message: result.message };
}

async function executeHandoffBatch(batch: RoutedPrintBatch): Promise<ExecuteResult> {
  const config = printerRecordToConfig(batch.printer);
  const slip = kitchenSlipFromBatch(batch);

  if (isNativePrintCapable()) {
    const posted = postNativeKitchenHandoffPrint({
      outletId: batch.meta.outletId,
      printerId: batch.printer.id,
      paperWidth: legacyPaperWidthMm(config.paperWidthMm),
      paperWidthMm: config.paperWidthMm,
      paperColumns: config.paperColumns,
      orderNumber: batch.meta.orderNumber,
      orderType: batch.meta.orderType,
      tableNumber: batch.meta.tableNumber,
      items: slip.items,
      createdAt: batch.meta.createdAt.toISOString(),
    });
    if (posted) return { ok: true };
    return { ok: false, message: "Native printer bridge unavailable" };
  }

  if (config.usbPortIndex === null) {
    return { ok: false, message: "Assign a printer port for handoff slip" };
  }
  try {
    const { layout, fontSize } = getPrintLayoutFromConfig(config);
    const bytes = buildKitchenHandoffSlip(slip, layout, fontSize, escPosOptionsFromPrinterConfig(config));
    await printViaSerial(config.usbPortIndex, bytes, config.baudRate);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export async function executePrintBatch(
  batch: RoutedPrintBatch,
  billingData?: BillingReceiptData
): Promise<ExecuteResult> {
  const jobType = batch.jobType;
  if (jobType === "kot" || jobType === "kot_cancel" || jobType === "kot_delta") {
    return executeKitchenBatch(batch);
  }
  if (jobType === "handoff") {
    return executeHandoffBatch(batch);
  }
  if (jobType === "bill" && billingData) {
    const config = printerRecordToConfig(batch.printer);
    if (isNativePrintCapable()) {
      const posted = postNativeBillingPrint({
        outletId: batch.meta.outletId,
        printerId: batch.printer.id,
        paperWidth: legacyPaperWidthMm(config.paperWidthMm),
        paperWidthMm: config.paperWidthMm,
        paperColumns: config.paperColumns,
        orderNumber: billingData.orderNumber,
        outletName: billingData.outletName,
        gstNumber: billingData.gstNumber,
        orderType: billingData.orderType,
        tableNumber: billingData.tableNumber,
        items: billingData.items,
        subtotal: billingData.subtotal,
        discountAmt: billingData.discountAmt,
        discountPercent: billingData.discountPercent,
        serviceTax: billingData.serviceTax,
        serviceTaxPercent: billingData.serviceTaxPercent,
        gstTotal: billingData.gstTotal,
        grandTotal: billingData.grandTotal,
        createdAt: billingData.createdAt.toISOString(),
        columnOffset: config.columnOffset,
        amountColumnWidth: config.amountColumnWidth,
        boldTotalLine: config.boldTotalLine,
      });
      if (posted) return { ok: true };
      return { ok: false, message: "Native printer bridge unavailable" };
    }
    if (config.usbPortIndex !== null) {
      try {
        const { layout, fontSize } = getPrintLayoutFromConfig(config);
        const bytes = buildBillingReceipt(billingData, layout, fontSize, escPosOptionsFromPrinterConfig(config));
        await printViaSerial(config.usbPortIndex, bytes, config.baudRate);
        return { ok: true };
      } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : String(e) };
      }
    }
    return { ok: false, message: "Billing print requires USB/serial or mobile app" };
  }
  return { ok: false, message: `Unsupported job type: ${jobType}` };
}

export async function executeTestPrint(printer: PrinterRecord): Promise<ExecuteResult> {
  const config = printerRecordToConfig(printer);
  const { layout, fontSize } = getPrintLayoutFromConfig(config);
  if (config.transport === "network") {
    return { ok: false, message: "Test LAN print: use the mobile app" };
  }
  if (config.usbPortIndex === null) {
    return { ok: false, message: "Assign a USB/serial port first" };
  }
  try {
    const bytes = buildCalibrationSlip(layout, fontSize, {
      postPrintFeedLines: config.postPrintFeedLines,
      showTearCutLine: config.showTearCutLine,
    });
    await printViaSerial(config.usbPortIndex, bytes, config.baudRate);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

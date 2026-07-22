import {
  buildKitchenSlip,
  buildKitchenCancelSlip,
  printViaSerial,
  type KitchenSlipData,
  type KitchenCancelSlipData,
} from "@/lib/serial-printer";
import {
  isNativePrinterBridgeExpected,
  isNativePrintCapable,
  openNativePrinterSettings,
  postNativeKitchenPrint,
  postNativeKitchenCancelPrint,
} from "@/lib/native-print-bridge";
import type { OutletPrinterSettings } from "@/lib/use-printer-settings";
import { getPrintLayoutFromConfig, legacyPaperWidthMm } from "@/lib/paper-width";
import type { FleetPrintContext } from "@/lib/print/print-service";
import { printRoutedKitchen } from "@/lib/print/print-service";

export type KitchenPrintResult = { ok: true } | { ok: false; message: string };

export interface KitchenOrderPrintInput {
  outletId?: string | null;
  orderNumber: string;
  orderType: "dine_in" | "takeaway";
  tableNumber?: string;
  items: { name: string; quantity: number; categoryId?: string | null }[];
  createdAt: Date;
  source?: string;
  selfServiceMode?: boolean;
}

export interface KitchenCancelPrintInput extends KitchenOrderPrintInput {
  cancelledAt?: Date;
}

function escPosOptions(settings: OutletPrinterSettings, selfServiceMode?: boolean) {
  const k = settings.kitchenPrinter;
  return {
    postPrintFeedLines: k.postPrintFeedLines,
    showTearCutLine: k.showTearCutLine,
    dualKitchenCopies: selfServiceMode ? false : k.dualKitchenCopies,
  };
}

export function printKitchenBrowser(
  orderData: KitchenOrderPrintInput,
  fontSize: number,
  paperWidthMm: number,
  title: string
): KitchenPrintResult {
  const pt = fontSize;
  const pw = paperWidthMm;
  const printWindow = window.open("", "_blank", "width=220,height=600");
  if (!printWindow) {
    return { ok: false, message: "Allow popups to print from the browser" };
  }

  const timeStr = orderData.createdAt.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const typeLabel =
    orderData.orderType === "dine_in"
      ? orderData.tableNumber
        ? `Table T${orderData.tableNumber}`
        : "Dine In"
      : "TAKEAWAY";

  const itemRows = orderData.items
    .map(
      (item) => `
      <tr>
        <td style="padding:3px 4px 3px 0;font-size:${pt}pt">${item.name}</td>
        <td style="text-align:right;padding:3px 0;font-size:${pt + 2}pt;font-weight:bold">x${item.quantity}</td>
      </tr>`
    )
    .join("");

  printWindow.document.write(`<!DOCTYPE html>
<html><head>
  <meta charset="utf-8"/><meta name="color-scheme" content="light"/>
  <title>${title} #${orderData.orderNumber}</title>
  <style>
    @page { size: ${pw}mm auto; margin: 0; }
    html, body { margin:0; padding:0; width:${pw}mm; background:#fff; color:#000;
      font-family:'Courier New',Courier,monospace; font-size:${pt}pt; }
    * { color:#000 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    table { border-collapse:collapse; width:100%; }
    .dash { border-top:1px dashed #000; margin:4px 0; }
    .center { text-align:center; } .bold { font-weight:bold; }
  </style>
</head>
<body style="padding:3mm 2mm">
  <div class="center bold" style="font-size:${pt + 3}pt;margin-bottom:3mm">${title}</div>
  <div class="dash"></div>
  <table>
    <tr><td class="bold">Order #</td><td style="text-align:right" class="bold">${orderData.orderNumber}</td></tr>
    <tr><td>Time</td><td style="text-align:right">${timeStr}</td></tr>
    <tr><td class="bold">${orderData.orderType === "dine_in" ? "Table" : "Type"}</td>
        <td style="text-align:right" class="bold">${typeLabel}</td></tr>
  </table>
  <div class="dash"></div>
  <table>
    <thead><tr class="bold" style="font-size:${pt - 1}pt"><td>ITEM</td><td style="text-align:right">QTY</td></tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div class="dash"></div>
  <div class="center" style="font-size:${pt - 1}pt;margin-top:2mm">— Kitchen Copy —</div>
  <div style="height:10mm"></div>
</body></html>`);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 400);
  return { ok: true };
}

async function printKitchenSerial(
  settings: OutletPrinterSettings,
  slipData: KitchenSlipData | KitchenCancelSlipData,
  build: typeof buildKitchenSlip | typeof buildKitchenCancelSlip
): Promise<KitchenPrintResult> {
  const k = settings.kitchenPrinter;
  if (k.printMode === "serial" && k.usbPortIndex === null) {
    return { ok: false, message: "Kitchen printer is set to Serial, but no port is assigned in Settings" };
  }
  if (k.usbPortIndex === null) {
    return { ok: false, message: "No serial port assigned for kitchen printer" };
  }
  try {
    const { layout, fontSize } = getPrintLayoutFromConfig(k);
    const bytes = build(slipData, layout, fontSize, escPosOptions(settings, slipData.selfServiceMode));
    await printViaSerial(k.usbPortIndex, bytes, k.baudRate);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: msg };
  }
}

async function printKitchenLegacy(
  settings: OutletPrinterSettings,
  input: KitchenOrderPrintInput,
  slipData: KitchenSlipData
): Promise<KitchenPrintResult> {
  const posted = await postNativeKitchenPrint({
    outletId: input.outletId,
    paperWidth: legacyPaperWidthMm(settings.kitchenPrinter.paperWidthMm),
    paperWidthMm: settings.kitchenPrinter.paperWidthMm,
    orderNumber: input.orderNumber,
    orderType: input.orderType,
    tableNumber: input.tableNumber,
    items: input.items,
    createdAt: input.createdAt.toISOString(),
    source: input.source,
    selfServiceMode: input.selfServiceMode,
  });
  if (isNativePrintCapable()) {
    return posted.ok ? { ok: true } : { ok: false, message: posted.message ?? "Kitchen print failed" };
  }

  if (isNativePrinterBridgeExpected()) {
    return { ok: false, message: "Native printer bridge unavailable" };
  }

  const k = settings.kitchenPrinter;

  if (k.transport === "network") {
    return {
      ok: false,
      message:
        "Wi‑Fi/LAN printing must be configured in the Flaze Android app (Settings → Printers → Native printer settings).",
    };
  }

  const useSerial =
    k.transport === "usb" ||
    k.transport === "bluetooth" ||
    k.printMode === "serial" ||
    k.usbPortIndex !== null;
  if (useSerial) {
    return printKitchenSerial(settings, slipData, buildKitchenSlip);
  }

  const title = input.selfServiceMode ? "** KITCHEN BILL **" : "** KITCHEN ORDER **";
  return printKitchenBrowser(input, k.fontSize, k.paperWidthMm, title);
}

export async function printKitchenOrderSlip(
  settings: OutletPrinterSettings,
  input: KitchenOrderPrintInput,
  fleet?: FleetPrintContext | null
): Promise<KitchenPrintResult> {
  if (fleet && fleet.printers.some((p) => p.enabled)) {
    const summary = await printRoutedKitchen(
      fleet,
      input.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        categoryId: i.categoryId,
      })),
      {
        outletId: input.outletId ?? fleet.settings.outlet_id,
        orderNumber: input.orderNumber,
        orderType: input.orderType,
        tableNumber: input.tableNumber,
        createdAt: input.createdAt,
        source: input.source,
        selfServiceMode: input.selfServiceMode,
      }
    );
    if (summary.total > 0) {
      if (summary.ok) return { ok: true };
      return {
        ok: false,
        message: summary.results.find((r) => !r.ok)?.message ?? "Some kitchen prints failed",
      };
    }
  }

  const slipData: KitchenSlipData = {
    orderNumber: input.orderNumber,
    orderType: input.orderType,
    tableNumber: input.tableNumber,
    items: input.items,
    createdAt: input.createdAt,
    source: input.source,
    selfServiceMode: input.selfServiceMode,
  };

  return printKitchenLegacy(settings, input, slipData);
}

export async function printKitchenCancelSlip(
  settings: OutletPrinterSettings,
  input: KitchenCancelPrintInput,
  fleet?: FleetPrintContext | null
): Promise<KitchenPrintResult> {
  if (fleet && fleet.printers.some((p) => p.enabled)) {
    const summary = await printRoutedKitchen(
      fleet,
      input.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        categoryId: i.categoryId,
      })),
      {
        outletId: input.outletId ?? fleet.settings.outlet_id,
        orderNumber: input.orderNumber,
        orderType: input.orderType,
        tableNumber: input.tableNumber,
        createdAt: input.createdAt,
        source: input.source,
        selfServiceMode: input.selfServiceMode,
      },
      { jobType: "kot_cancel", skipAutoPrintCheck: true }
    );
    if (summary.total > 0) {
      if (summary.ok) return { ok: true };
      return { ok: false, message: summary.results.find((r) => !r.ok)?.message ?? "Cancel print failed" };
    }
  }

  return printKitchenCancelSlipLegacy(settings, input);
}

async function printKitchenCancelSlipLegacy(
  settings: OutletPrinterSettings,
  input: KitchenCancelPrintInput
): Promise<KitchenPrintResult> {
  const slipData: KitchenCancelSlipData = {
    orderNumber: input.orderNumber,
    orderType: input.orderType,
    tableNumber: input.tableNumber,
    items: input.items,
    createdAt: input.createdAt,
    cancelledAt: input.cancelledAt ?? new Date(),
  };

  const posted = await postNativeKitchenCancelPrint({
    outletId: input.outletId,
    paperWidth: legacyPaperWidthMm(settings.kitchenPrinter.paperWidthMm),
    paperWidthMm: settings.kitchenPrinter.paperWidthMm,
    orderNumber: input.orderNumber,
    orderType: input.orderType,
    tableNumber: input.tableNumber,
    items: input.items,
    createdAt: input.createdAt.toISOString(),
    cancelledAt: (input.cancelledAt ?? new Date()).toISOString(),
  });
  if (isNativePrintCapable()) {
    return posted.ok ? { ok: true } : { ok: false, message: posted.message ?? "Kitchen cancel print failed" };
  }

  if (isNativePrinterBridgeExpected()) {
    return { ok: false, message: "Native printer bridge unavailable" };
  }

  const k = settings.kitchenPrinter;

  if (k.transport === "network") {
    return {
      ok: false,
      message:
        "Wi‑Fi/LAN printing must be configured in the Flaze Android app (Settings → Printers → Native printer settings).",
    };
  }

  const useSerial =
    k.transport === "usb" ||
    k.transport === "bluetooth" ||
    k.printMode === "serial" ||
    k.usbPortIndex !== null;
  if (useSerial) {
    return printKitchenSerial(settings, slipData, buildKitchenCancelSlip);
  }

  return printKitchenBrowser(
    input,
    k.fontSize,
    k.paperWidthMm,
    "** CANCELLED — DO NOT PREPARE **"
  );
}

export function openKitchenPrinterSettingsIfNeeded(): void {
  if (isNativePrinterBridgeExpected()) {
    openNativePrinterSettings();
  }
}

import {
  buildKitchenSlip,
  buildKitchenCancelSlip,
  printViaSerial,
  type KitchenSlipData,
  type KitchenCancelSlipData,
} from "@/lib/serial-printer";
import {
  isNativePrinterBridgeExpected,
  openNativePrinterSettings,
  postNativeKitchenPrint,
  postNativeKitchenCancelPrint,
} from "@/lib/native-print-bridge";
import type { OutletPrinterSettings } from "@/lib/use-printer-settings";

export type KitchenPrintResult = { ok: true } | { ok: false; message: string };

export interface KitchenOrderPrintInput {
  outletId?: string | null;
  orderNumber: string;
  orderType: "dine_in" | "takeaway";
  tableNumber?: string;
  items: { name: string; quantity: number }[];
  createdAt: Date;
}

export interface KitchenCancelPrintInput extends KitchenOrderPrintInput {
  cancelledAt?: Date;
}

function escPosOptions(settings: OutletPrinterSettings) {
  const k = settings.kitchenPrinter;
  return {
    postPrintFeedLines: k.postPrintFeedLines,
    showTearCutLine: k.showTearCutLine,
    dualKitchenCopies: k.dualKitchenCopies,
  };
}

function printKitchenBrowser(
  orderData: KitchenOrderPrintInput,
  fontSize: number,
  paperWidth: 58 | 80,
  title: string
): KitchenPrintResult {
  const pt = fontSize;
  const pw = paperWidth;
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
    const bytes = build(slipData, k.paperWidth, escPosOptions(settings));
    await printViaSerial(k.usbPortIndex, bytes, k.baudRate);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: msg };
  }
}

export async function printKitchenOrderSlip(
  settings: OutletPrinterSettings,
  input: KitchenOrderPrintInput
): Promise<KitchenPrintResult> {
  const slipData: KitchenSlipData = {
    orderNumber: input.orderNumber,
    orderType: input.orderType,
    tableNumber: input.tableNumber,
    items: input.items,
    createdAt: input.createdAt,
  };

  const posted = postNativeKitchenPrint({
    outletId: input.outletId,
    paperWidth: settings.kitchenPrinter.paperWidth,
    orderNumber: input.orderNumber,
    orderType: input.orderType,
    tableNumber: input.tableNumber,
    items: input.items,
    createdAt: input.createdAt.toISOString(),
  });
  if (posted) return { ok: true };

  if (isNativePrinterBridgeExpected()) {
    return { ok: false, message: "Native printer bridge unavailable" };
  }

  const k = settings.kitchenPrinter;
  const useSerial = k.printMode === "serial" || k.usbPortIndex !== null;
  if (useSerial) {
    return printKitchenSerial(settings, slipData, buildKitchenSlip);
  }

  return printKitchenBrowser(input, k.fontSize, k.paperWidth, "** KITCHEN ORDER **");
}

export async function printKitchenCancelSlip(
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

  const posted = postNativeKitchenCancelPrint({
    outletId: input.outletId,
    paperWidth: settings.kitchenPrinter.paperWidth,
    orderNumber: input.orderNumber,
    orderType: input.orderType,
    tableNumber: input.tableNumber,
    items: input.items,
    createdAt: input.createdAt.toISOString(),
    cancelledAt: (input.cancelledAt ?? new Date()).toISOString(),
  });
  if (posted) return { ok: true };

  if (isNativePrinterBridgeExpected()) {
    return { ok: false, message: "Native printer bridge unavailable" };
  }

  const k = settings.kitchenPrinter;
  const useSerial = k.printMode === "serial" || k.usbPortIndex !== null;
  if (useSerial) {
    return printKitchenSerial(settings, slipData, buildKitchenCancelSlip);
  }

  return printKitchenBrowser(
    input,
    k.fontSize,
    k.paperWidth,
    "** CANCELLED — DO NOT PREPARE **"
  );
}

export function openKitchenPrinterSettingsIfNeeded(): void {
  if (isNativePrinterBridgeExpected()) {
    openNativePrinterSettings();
  }
}

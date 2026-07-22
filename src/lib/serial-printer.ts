// ESC/POS thermal printer support via Web Serial API.
// Users grant port permission once; after that prints are silent (no dialog).

import type { PrintLayout } from "@/lib/paper-width";
import {
  colsLine,
  formatItemLine,
  formatMoney,
  formatReceiptDateTime,
  formatReceiptTime,
  receiptLayoutFromFields,
  truncateCenter,
  type ReceiptLayoutConfig,
} from "@/lib/receipt-layout";

// ── ESC/POS command constants ────────────────────────────────────────────────
const ESC = 0x1B;
const GS  = 0x1D;
const LF  = 0x0A;

// ── Document builder ─────────────────────────────────────────────────────────
class EscPosDoc {
  private b: number[] = [];

  init()   { this.b.push(ESC, 0x40); return this; }
  lf()     { this.b.push(LF); return this; }

  align(t: "L" | "C" | "R") {
    this.b.push(ESC, 0x61, t === "L" ? 0 : t === "C" ? 1 : 2);
    return this;
  }

  bold(on: boolean) { this.b.push(ESC, 0x45, on ? 1 : 0); return this; }

  /** Font B (condensed) when true — fits more columns visually */
  font(condensed: boolean) {
    this.b.push(ESC, 0x4d, condensed ? 1 : 0);
    return this;
  }

  // dh = double height, dw = double width
  size(dh: boolean, dw: boolean) {
    this.b.push(GS, 0x21, (dh ? 0x01 : 0) | (dw ? 0x10 : 0));
    return this;
  }

  text(s: string) {
    // Replace ₹ and any non-Latin-1 char for printer compatibility
    const safe = s.replace(/₹/g, "Rs.").replace(/[^\x00-\xFF]/g, "?");
    for (let i = 0; i < safe.length; i++) this.b.push(safe.charCodeAt(i) & 0xFF);
    return this;
  }

  line(s = "")  { return this.text(s).lf(); }
  dashes(n: number) { return this.line("-".repeat(n)); }

  // left + right-aligned text padded to total width
  cols(left: string, right: string, width: number) {
    const pad = Math.max(1, width - left.length - right.length);
    return this.line(left + " ".repeat(pad) + right);
  }

  feed(n = 4)  { this.b.push(ESC, 0x64, n); return this; }
  cut()        { this.b.push(GS, 0x56, 0x42, 0x00); return this; }
  bytes()      { return new Uint8Array(this.b); }
}

function beginDoc(fontSize = 12): EscPosDoc {
  const d = new EscPosDoc().init();
  d.font(fontSize <= 11);
  return d;
}

/** Options for ESC/POS layout (thermal spacing, tear guide, duplicate copies). */
export interface EscPosPrintOptions {
  postPrintFeedLines?: number;
  showTearCutLine?: boolean;
  dualKitchenCopies?: boolean;
  dualBillingCopies?: boolean;
  columnOffset?: number;
  amountColumnWidth?: number;
  boldTotalLine?: boolean;
}

function receiptLayout(layout: PrintLayout, options?: EscPosPrintOptions): ReceiptLayoutConfig {
  return receiptLayoutFromFields(layout.columns, options);
}

function lineWidth(layout: ReceiptLayoutConfig): number {
  return layout.columns;
}

function printOrderHighlight(d: EscPosDoc, orderNumber: string) {
  d.align("C").bold(true).size(true, true).line(`ORDER #${orderNumber}`).size(false, false).bold(false);
  d.align("L");
}

function printBillingHeader(
  d: EscPosDoc,
  data: { restaurantName?: string; outletName: string; gstNumber?: string | null },
  w: number
) {
  const restaurant = data.restaurantName?.trim() || data.outletName.trim();
  const outlet = data.outletName.trim();
  if (restaurant) {
    d.align("C").bold(true).line(truncateCenter(restaurant, w)).bold(false);
  }
  if (data.restaurantName?.trim() && outlet && outlet !== restaurant) {
    d.align("C").line(truncateCenter(outlet, w));
  }
  if (data.gstNumber) d.align("C").line(`GSTIN: ${data.gstNumber}`);
}

function clampPostPrintFeed(n: number | undefined, fallback = 4): number {
  if (n == null || !Number.isFinite(n)) return fallback;
  return Math.min(24, Math.max(1, Math.round(n)));
}

function appendTearCutLine(d: EscPosDoc, width: number) {
  d.line("");
  d.align("C").dashes(width);
  d.align("C").bold(true).line("- - - CUT / TEAR - - -").bold(false);
  d.align("C").dashes(width);
  d.line("");
}

function formatSourceBanner(source?: string): string | null {
  if (!source || source === "pos") return null;
  const map: Record<string, string> = {
    zomato: "ZOMATO ORDER",
    swiggy: "SWIGGY ORDER",
    customer_app: "ONLINE ORDER",
    online: "ONLINE ORDER",
  };
  return map[source] ?? `${source.replace(/_/g, " ").toUpperCase()} ORDER`;
}

function writeKitchenSlipBody(
  d: EscPosDoc,
  data: KitchenSlipData,
  rl: ReceiptLayoutConfig
) {
  const w = lineWidth(rl);
  const timeStr = formatReceiptTime(data.createdAt);
  const typeLabel = data.orderType === "dine_in"
    ? (data.tableNumber ? `T${data.tableNumber}` : "Dine In")
    : "TAKEAWAY";

  const sourceBanner = formatSourceBanner(data.source);
  if (sourceBanner) {
    d.align("C").bold(true).line(`*** ${sourceBanner} ***`).bold(false);
    d.line("");
  }

  const header = data.selfServiceMode ? "KITCHEN BILL" : "KITCHEN";
  d.align("C").bold(true).line(header).bold(false);
  d.align("L").dashes(w);
  printOrderHighlight(d, data.orderNumber);
  d.line(colsLine("Time", timeStr, rl));
  d.bold(true).line(colsLine(data.orderType === "dine_in" ? "Table" : "Type", typeLabel, rl)).bold(false);
  d.dashes(w);
  d.bold(true).line(colsLine("ITEM", "QTY", rl)).bold(false);

  for (const item of data.items) {
    d.line(formatItemLine(item.name, item.quantity, null, rl));
  }

  d.dashes(w);
}

/** Items + quantity only — customer takes this slip to the kitchen (self service). */
export function writeKitchenHandoffBody(
  d: EscPosDoc,
  data: {
    orderNumber: string;
    orderType: "dine_in" | "takeaway";
    tableNumber?: string;
    items: { name: string; quantity: number }[];
    createdAt: Date;
  },
  rl: ReceiptLayoutConfig
) {
  const w = lineWidth(rl);
  const timeStr = formatReceiptTime(data.createdAt);
  const typeLabel =
    data.orderType === "dine_in"
      ? data.tableNumber
        ? `Table T${data.tableNumber}`
        : "Takeaway"
      : "TAKEAWAY";

  d.align("C").bold(true).line("TAKE TO KITCHEN").bold(false);
  d.align("C").line("Give this slip to prepare your order");
  d.dashes(w);
  printOrderHighlight(d, data.orderNumber);
  d.line(colsLine("Time", timeStr, rl));
  d.line(colsLine("Type", typeLabel, rl));
  d.dashes(w);
  d.bold(true).line(colsLine("ITEM", "QTY", rl)).bold(false);
  for (const item of data.items) {
    d.line(formatItemLine(item.name, item.quantity, null, rl));
  }
  d.dashes(w);
}

// ── Kitchen slip ──────────────────────────────────────────────────────────────
export interface KitchenSlipData {
  orderNumber: string;
  orderType: "dine_in" | "takeaway";
  tableNumber?: string;
  items: { name: string; quantity: number }[];
  createdAt: Date;
  source?: string;
  selfServiceMode?: boolean;
  customerName?: string;
}

/** Calibration slip — ruler lines at common column counts to pick the best fit. */
export function buildCalibrationSlip(
  layout: PrintLayout,
  fontSize = 12,
  options?: EscPosPrintOptions
): Uint8Array {
  const w = layout.columns;
  const d = beginDoc(fontSize);
  const feed = clampPostPrintFeed(options?.postPrintFeedLines);
  const showCut = options?.showTearCutLine !== false;

  d.align("C").bold(true).line("PAPER CALIBRATION").bold(false);
  d.align("C").line(`${layout.paperWidthMm}mm · ${w} cols · ${fontSize}pt`);
  d.dashes(w);
  d.line("Full width for YOUR setting:");
  d.line("=".repeat(w));
  d.dashes(w);
  d.bold(true).line("Compare these lines to paper edge:").bold(false);
  for (const n of [32, 40, 48, 54]) {
    const label = `${n} cols`;
    const bar = "=".repeat(Math.min(n, w));
    d.line(`${label}: ${bar}`);
  }
  d.dashes(w);
  d.align("C").line("Use the longest line that");
  d.align("C").line("fits without wrapping");
  if (showCut) appendTearCutLine(d, w);
  d.feed(feed).cut();
  return d.bytes();
}

export function buildKitchenSlip(
  data: KitchenSlipData,
  layout: PrintLayout,
  fontSize = 12,
  options?: EscPosPrintOptions
): Uint8Array {
  const rl = receiptLayout(layout, options);
  const w = lineWidth(rl);
  const d = beginDoc(fontSize);
  const feed = clampPostPrintFeed(options?.postPrintFeedLines);
  const showCut = options?.showTearCutLine !== false;
  const dual = !data.selfServiceMode && options?.dualKitchenCopies === true;

  if (!dual) {
    writeKitchenSlipBody(d, data, rl);
    d.align("C").line(data.selfServiceMode ? "-- Kitchen Bill --" : "-- Kitchen Copy --");
    if (showCut) appendTearCutLine(d, w);
    d.feed(feed).cut();
    return d.bytes();
  }

  writeKitchenSlipBody(d, data, rl);
  d.align("C").bold(true).line("* KITCHEN COPY *").bold(false);
  if (showCut) appendTearCutLine(d, w);

  writeKitchenSlipBody(d, data, rl);
  const secondLabel = data.orderType === "takeaway" ? "* PARCEL COPY *" : "* TABLE COPY *";
  d.align("C").bold(true).line(secondLabel).bold(false);
  if (showCut) appendTearCutLine(d, w);
  d.feed(feed).cut();

  return d.bytes();
}

// ── Customer token (self-service counter) ─────────────────────────────────────
export interface CustomerTokenSlipData {
  orderNumber: string;
  outletName?: string;
  orderType: "dine_in" | "takeaway";
  tableNumber?: string;
  items: { name: string; quantity: number }[];
  total: number;
  createdAt: Date;
  source?: string;
}

export function buildCustomerTokenSlip(
  data: CustomerTokenSlipData,
  layout: PrintLayout,
  fontSize = 12,
  options?: EscPosPrintOptions
): Uint8Array {
  const rl = receiptLayout(layout, options);
  const w = lineWidth(rl);
  const d = beginDoc(fontSize);
  const feed = clampPostPrintFeed(options?.postPrintFeedLines);
  const showCut = options?.showTearCutLine !== false;
  const timeStr = formatReceiptTime(data.createdAt);

  const sourceBanner = formatSourceBanner(data.source);
  if (sourceBanner) {
    d.align("C").bold(true).line(`*** ${sourceBanner} ***`).bold(false);
  }

  d.align("C").bold(true).size(true, true).line("CUSTOMER TOKEN").size(false, false).bold(false);
  if (data.outletName) d.align("C").line(truncateCenter(data.outletName, w));
  d.align("C").line("Please wait for your order");
  d.dashes(w);
  printOrderHighlight(d, data.orderNumber);
  d.line(colsLine("Time", timeStr, rl));
  const typeLabel =
    data.orderType === "dine_in"
      ? data.tableNumber
        ? `Table T${data.tableNumber}`
        : "Counter"
      : "Takeaway";
  d.line(colsLine("Type", typeLabel, rl));
  d.dashes(w);
  d.bold(true).line(colsLine("ITEM", "QTY", rl)).bold(false);
  for (const item of data.items) {
    d.line(formatItemLine(item.name, item.quantity, null, rl));
  }
  d.dashes(w);
  const totalLine = colsLine("TOTAL", formatMoney(data.total), rl);
  if (options?.boldTotalLine) {
    d.bold(true).line(totalLine).bold(false);
  } else {
    d.line(totalLine);
  }
  d.dashes(w);
  d.align("C").line("Show this token at pickup");
  if (showCut) appendTearCutLine(d, w);
  d.feed(feed).cut();
  return d.bytes();
}

export interface KitchenCancelSlipData {
  orderNumber: string;
  orderType: "dine_in" | "takeaway";
  tableNumber?: string;
  items: { name: string; quantity: number }[];
  createdAt: Date;
  cancelledAt?: Date;
}

export function buildKitchenCancelSlip(
  data: KitchenCancelSlipData,
  layout: PrintLayout,
  fontSize = 12,
  options?: EscPosPrintOptions
): Uint8Array {
  const rl = receiptLayout(layout, options);
  const w = lineWidth(rl);
  const d = beginDoc(fontSize);
  const feed = clampPostPrintFeed(options?.postPrintFeedLines);
  const showCut = options?.showTearCutLine !== false;
  const placedTime = formatReceiptTime(data.createdAt);
  const cancelTime = formatReceiptTime(data.cancelledAt ?? new Date());
  const typeLabel = data.orderType === "dine_in"
    ? (data.tableNumber ? `T${data.tableNumber}` : "Dine In")
    : "TAKEAWAY";

  d.align("C").bold(true).size(true, true).line("CANCELLED").size(false, false).bold(false);
  d.align("C").bold(true).line("DO NOT PREPARE").bold(false);
  d.dashes(w);
  printOrderHighlight(d, data.orderNumber);
  d.line(colsLine("Was", typeLabel, rl));
  d.line(colsLine("Placed", placedTime, rl));
  d.line(colsLine("Cancelled", cancelTime, rl));
  d.dashes(w);
  d.bold(true).line("CANCELLED ITEMS:").bold(false);

  for (const item of data.items) {
    d.line(formatItemLine(`X ${item.name}`, item.quantity, null, rl));
  }

  d.dashes(w);
  d.align("C").bold(true).line("*** VOID ***").bold(false);
  if (showCut) appendTearCutLine(d, w);
  d.feed(feed).cut();
  return d.bytes();
}

// ── Billing receipt ───────────────────────────────────────────────────────────
export interface BillingReceiptData {
  orderNumber: string;
  restaurantName?: string;
  outletName: string;
  gstNumber?: string | null;
  orderType: "dine_in" | "takeaway";
  tableNumber?: string;
  items: { name: string; quantity: number; totalPrice: number; gstRate?: number }[];
  subtotal: number;
  discountAmt: number;
  discountPercent?: number;
  serviceTax: number;
  serviceTaxPercent: number;
  gstTotal: number;
  grandTotal: number;
  createdAt: Date;
}

function writeBillingReceiptBody(
  d: EscPosDoc,
  data: BillingReceiptData,
  rl: ReceiptLayoutConfig,
  options?: EscPosPrintOptions
) {
  const w = lineWidth(rl);
  const fmt = formatMoney;
  const dateStr = formatReceiptDateTime(data.createdAt);

  printBillingHeader(d, data, w);
  d.align("L").dashes(w);
  printOrderHighlight(d, data.orderNumber);
  d.line(colsLine("Date", dateStr, rl));
  d.bold(true).line(colsLine("Type", data.orderType === "dine_in" ? "DINE IN" : "TAKEAWAY", rl)).bold(false);
  if (data.orderType === "dine_in" && data.tableNumber) {
    d.bold(true).line(colsLine("Table", data.tableNumber, rl)).bold(false);
  }

  d.dashes(w);
  d.bold(true).line(colsLine("ITEM", "QTY  AMT", rl)).bold(false);

  for (const item of data.items) {
    d.line(formatItemLine(item.name, item.quantity, item.totalPrice, rl));
    if (item.gstRate && item.totalPrice > 0) {
      const gstAmt = fmt(item.totalPrice * item.gstRate / 100);
      const gstLabel = `  +GST @${item.gstRate}%`;
      d.line(colsLine(gstLabel, gstAmt, rl));
    }
  }

  d.dashes(w);
  d.line(colsLine("Subtotal", fmt(data.subtotal), rl));
  if (data.discountAmt > 0) {
    const lbl = data.discountPercent ? `Discount (${data.discountPercent}%)` : "Discount";
    d.line(colsLine(lbl, "-" + fmt(data.discountAmt), rl));
  }
  if (data.gstTotal > 0) d.line(colsLine("GST", fmt(data.gstTotal), rl));
  if (data.serviceTax > 0) {
    d.line(colsLine(`Service Tax (${data.serviceTaxPercent}%)`, "+" + fmt(data.serviceTax), rl));
  }

  d.dashes(w);
  const totalLine = colsLine("TOTAL", fmt(data.grandTotal), rl);
  if (options?.boldTotalLine) {
    d.bold(true).line(totalLine).bold(false);
  } else {
    d.line(totalLine);
  }

  d.dashes(w);
  d.align("C").line("Thank you!").line("Visit us again soon");
  d.line("Powered by flazee.com");
}

export interface KitchenHandoffSlipData {
  orderNumber: string;
  orderType: "dine_in" | "takeaway";
  tableNumber?: string;
  items: { name: string; quantity: number }[];
  createdAt: Date;
}

/** Self service job 1: customer bill only — ends with printer cut (no kitchen section). */
export function buildSelfServiceMainBill(
  data: BillingReceiptData,
  layout: PrintLayout,
  fontSize = 12,
  options?: EscPosPrintOptions
): Uint8Array {
  const rl = receiptLayout(layout, options);
  const d = beginDoc(fontSize);
  const feed = clampPostPrintFeed(options?.postPrintFeedLines);

  d.align("C").bold(true).line("*** CUSTOMER COPY ***").bold(false);
  writeBillingReceiptBody(d, data, rl, options);
  d.line("");
  d.feed(feed).cut();
  return d.bytes();
}

/** Self service job 2: kitchen handoff (items + qty) — separate print after main bill cut. */
export function buildKitchenHandoffSlip(
  data: KitchenHandoffSlipData,
  layout: PrintLayout,
  fontSize = 12,
  options?: EscPosPrintOptions
): Uint8Array {
  const rl = receiptLayout(layout, options);
  const d = beginDoc(fontSize);
  const feed = clampPostPrintFeed(options?.postPrintFeedLines);

  writeKitchenHandoffBody(d, data, rl);
  d.feed(feed).cut();
  return d.bytes();
}

/**
 * @deprecated Combined bill+kitchen on one slip — do not use.
 * Use buildSelfServiceMainBill + buildKitchenHandoffSlip as two separate print jobs.
 */
export function buildSelfServiceBillingReceipt(
  data: BillingReceiptData,
  layout: PrintLayout,
  fontSize = 12,
  options?: EscPosPrintOptions
): Uint8Array {
  const handoff: KitchenHandoffSlipData = {
    orderNumber: data.orderNumber,
    orderType: data.orderType,
    tableNumber: data.tableNumber,
    items: data.items.map((i) => ({ name: i.name, quantity: i.quantity })),
    createdAt: data.createdAt,
  };
  const rl = receiptLayout(layout, options);
  const w = lineWidth(rl);
  const d = beginDoc(fontSize);
  const feed = clampPostPrintFeed(options?.postPrintFeedLines);
  const showCut = options?.showTearCutLine !== false;

  d.align("C").bold(true).line("*** CUSTOMER BILL ***").bold(false);
  writeBillingReceiptBody(d, data, rl, options);
  if (showCut) appendTearCutLine(d, w);
  writeKitchenHandoffBody(d, handoff, rl);
  if (showCut) appendTearCutLine(d, w);
  d.feed(feed).cut();
  return d.bytes();
}

export function buildBillingReceipt(
  data: BillingReceiptData,
  layout: PrintLayout,
  fontSize = 12,
  options?: EscPosPrintOptions
): Uint8Array {
  const rl = receiptLayout(layout, options);
  const w = lineWidth(rl);
  const d = beginDoc(fontSize);
  const feed = clampPostPrintFeed(options?.postPrintFeedLines);
  const showCut = options?.showTearCutLine !== false;
  const dual = options?.dualBillingCopies === true;

  if (!dual) {
    writeBillingReceiptBody(d, data, rl, options);
    if (showCut) appendTearCutLine(d, w);
    d.feed(feed).cut();
    return d.bytes();
  }

  d.align("C").bold(true).line("*** COUNTER COPY ***").bold(false);
  writeBillingReceiptBody(d, data, rl, options);
  if (showCut) appendTearCutLine(d, w);

  d.align("C").bold(true).line("*** CUSTOMER COPY ***").bold(false);
  writeBillingReceiptBody(d, data, rl, options);
  if (showCut) appendTearCutLine(d, w);
  d.feed(feed).cut();

  return d.bytes();
}

// ── Web Serial API wrappers ───────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */

export function isWebSerialSupported(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

// Known USB-Serial chip IDs → human-readable label
const KNOWN_CHIPS: Record<string, string> = {
  "1a86:7523": "USB Printer (CH340)",
  "1a86:55d4": "USB Printer (CH343)",
  "0403:6001": "USB Printer (FTDI)",
  "10c4:ea60": "USB Printer (CP2102)",
  "0483:5740": "USB Printer (STM32)",
  "04b8:0202": "Epson Printer",
  "0483:5720": "USB Printer",
};

// Common Bluetooth service class IDs
const BLUETOOTH_SERVICES: Record<number, string> = {
  0x1101: "Bluetooth Printer (SPP)",
  0x1105: "Bluetooth OBEX",
  0x1106: "Bluetooth OBEX File",
};

export interface GrantedPort {
  index: number;
  label: string;       // auto-detected fallback label
  isBluetooth: boolean;
  vendorId?: number;
  productId?: number;
  bluetoothServiceClassId?: number;
}

export async function getGrantedPorts(): Promise<GrantedPort[]> {
  if (!isWebSerialSupported()) return [];
  const ports: any[] = await (navigator as any).serial.getPorts();
  return ports.map((port, index) => {
    const info = port.getInfo() as any;
    const isBluetooth = "bluetoothServiceClassId" in info;
    let label: string;
    if (isBluetooth) {
      label = BLUETOOTH_SERVICES[info.bluetoothServiceClassId] ?? "Bluetooth Printer";
    } else if (info.usbVendorId !== undefined && info.usbProductId !== undefined) {
      const key = `${info.usbVendorId.toString(16).padStart(4, "0")}:${info.usbProductId.toString(16).padStart(4, "0")}`;
      label = KNOWN_CHIPS[key] ?? `USB Device (${key.toUpperCase()})`;
    } else {
      // Windows Bluetooth virtual COM ports return empty getInfo()
      label = "Bluetooth Serial Port";
    }
    return {
      index, label, isBluetooth,
      vendorId: info.usbVendorId,
      productId: info.usbProductId,
      bluetoothServiceClassId: info.bluetoothServiceClassId,
    };
  });
}

// Show port picker, return index of the newly granted port in getPorts() list.
// Pass connectionType="usb" to hide Bluetooth serial ports from the picker.
export async function requestAndGetPortIndex(
  connectionType: "usb" | "bluetooth" | "none" = "none"
): Promise<number | null> {
  if (!isWebSerialSupported()) return null;
  try {
    const options: any = {};
    if (connectionType === "usb") {
      // Empty array excludes all Bluetooth service class IDs → USB only
      options.allowedBluetoothServiceClassIds = [];
    }
    await (navigator as any).serial.requestPort(options);
    const ports: any[] = await (navigator as any).serial.getPorts();
    return ports.length - 1;
  } catch {
    return null;
  }
}

async function openPort(port: any, baudRate: number) {
  try { await port.close(); } catch { /* wasn't open */ }
  await port.open({
    baudRate,
    dataBits: 8,
    stopBits: 1,
    parity: "none",
    flowControl: "none",
  });
}

// Send raw bytes to a previously-granted serial port by its index in getPorts()
export async function printViaSerial(
  portIndex: number,
  data: Uint8Array,
  baudRate = 9600
): Promise<void> {
  if (!isWebSerialSupported()) throw new Error("Web Serial not supported");
  const ports: any[] = await (navigator as any).serial.getPorts();
  if (portIndex < 0 || portIndex >= ports.length) {
    throw new Error("Printer not found — reconnect it and re-assign the port");
  }

  const port = ports[portIndex];
  await openPort(port, baudRate);
  try {
    const writer = port.writable!.getWriter();
    try {
      await writer.write(data);
    } finally {
      writer.releaseLock();
    }
    await new Promise<void>((r) => setTimeout(r, 600)); // let printer digest
  } finally {
    try { await port.close(); } catch { /* ignore */ }
  }
}

// Open and immediately close a port — used to verify the connection works
export async function testPortConnection(portIndex: number, baudRate = 9600): Promise<void> {
  if (!isWebSerialSupported()) throw new Error("Web Serial not supported");
  const ports: any[] = await (navigator as any).serial.getPorts();
  if (portIndex < 0 || portIndex >= ports.length) {
    throw new Error("Port not found — try re-adding the printer");
  }
  const port = ports[portIndex];
  await openPort(port, baudRate);
  try { await port.close(); } catch { /* ignore */ }
}

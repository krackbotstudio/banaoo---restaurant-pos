const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

class EscPosDoc {
  private bytesArr: number[] = [];

  init() {
    this.bytesArr.push(ESC, 0x40);
    return this;
  }

  align(value: "L" | "C" | "R") {
    this.bytesArr.push(ESC, 0x61, value === "L" ? 0 : value === "C" ? 1 : 2);
    return this;
  }

  bold(on: boolean) {
    this.bytesArr.push(ESC, 0x45, on ? 1 : 0);
    return this;
  }

  size(doubleH: boolean, doubleW: boolean) {
    this.bytesArr.push(GS, 0x21, (doubleH ? 0x01 : 0) | (doubleW ? 0x10 : 0));
    return this;
  }

  font(condensed: boolean) {
    // ESC M n -> 0: Font A (normal), 1: Font B (condensed)
    this.bytesArr.push(ESC, 0x4d, condensed ? 1 : 0);
    return this;
  }

  text(value: string) {
    const safe = value.replace(/₹/g, "Rs.").replace(/[^\x00-\xFF]/g, "?");
    for (let i = 0; i < safe.length; i++) {
      this.bytesArr.push(safe.charCodeAt(i) & 0xff);
    }
    return this;
  }

  line(value = "") {
    this.text(value);
    this.bytesArr.push(LF);
    return this;
  }

  dashes(count: number) {
    return this.line("-".repeat(count));
  }

  cols(left: string, right: string, width: number) {
    const pad = Math.max(1, width - left.length - right.length);
    return this.line(left + " ".repeat(pad) + right);
  }

  feed(lines = 4) {
    this.bytesArr.push(ESC, 0x64, lines);
    return this;
  }

  cut() {
    this.bytesArr.push(GS, 0x56, 0x42, 0x00);
    return this;
  }

  bytes() {
    return new Uint8Array(this.bytesArr);
  }
}

const columns = (paperWidth: 58 | 80) => (paperWidth === 58 ? 32 : 48);

/** ESC/POS layout options (matches web `serial-printer` behavior). */
export interface EscPosPrintOptions {
  postPrintFeedLines?: number;
  showTearCutLine?: boolean;
  dualKitchenCopies?: boolean;
  dualBillingCopies?: boolean;
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

function writeKitchenSlipBody(d: EscPosDoc, data: KitchenSlipPayload, w: number) {
  const time = data.createdAt.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const typeLabel =
    data.orderType === "dine_in" ? (data.tableNumber ? `T${data.tableNumber}` : "Dine In") : "TAKEAWAY";

  d.align("C").bold(true).size(true, true).line("KITCHEN").size(false, false).bold(false);
  d.align("L").dashes(w);
  d.cols("Order #", data.orderNumber, w);
  d.cols("Time", time, w);
  d.bold(true).cols(data.orderType === "dine_in" ? "Table" : "Type", typeLabel, w).bold(false);
  d.dashes(w);
  d.bold(true).line("ITEM" + " ".repeat(w - 7) + "QTY").bold(false);

  for (const item of data.items) {
    const qty = `x${item.quantity}`;
    const max = w - qty.length - 1;
    const name = item.name.length > max ? `${item.name.slice(0, max - 1)}.` : item.name;
    d.cols(name, qty, w);
  }

  d.dashes(w);
}

function writeBillingReceiptBody(d: EscPosDoc, data: BillingReceiptPayload, w: number, fmt: (n: number) => string) {
  const date = data.createdAt.toLocaleString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  d.align("C").bold(true).line(data.outletName.slice(0, w)).bold(false);
  if (data.gstNumber) d.align("C").line(`GSTIN: ${data.gstNumber}`);
  d.align("L").dashes(w);
  d.cols("Order #", data.orderNumber, w);
  d.cols("Date", date, w);
  d.bold(true).cols("Type", data.orderType === "dine_in" ? "DINE IN" : "TAKEAWAY", w).bold(false);
  if (data.orderType === "dine_in" && data.tableNumber) d.bold(true).cols("Table", data.tableNumber, w).bold(false);
  d.dashes(w);
  d.bold(true).line("ITEM" + " ".repeat(w - 11) + "QTY  AMT").bold(false);

  for (const item of data.items) {
    const amt = fmt(item.totalPrice);
    const qty = `x${item.quantity}`;
    const max = w - qty.length - amt.length - 2;
    const name = item.name.length > max ? `${item.name.slice(0, max - 1)}.` : item.name;
    const pad = Math.max(1, w - name.length - qty.length - amt.length - 1);
    d.line(name + " " + qty + " ".repeat(pad) + amt);
    if (item.gstRate && item.totalPrice > 0) {
      const gstAmt = fmt(item.totalPrice * item.gstRate / 100);
      d.line(`  +GST @${item.gstRate}%`.padEnd(w - gstAmt.length) + gstAmt);
    }
  }

  d.dashes(w);
  d.cols("Subtotal", fmt(data.subtotal), w);
  if (data.discountAmt > 0) {
    const discountLabel = data.discountPercent ? `Discount (${data.discountPercent}%)` : "Discount";
    d.cols(discountLabel, "-" + fmt(data.discountAmt), w);
  }
  if (data.gstTotal > 0) d.cols("GST", fmt(data.gstTotal), w);
  if (data.serviceTax > 0) d.cols(`Service (${data.serviceTaxPercent}%)`, "+" + fmt(data.serviceTax), w);
  d.dashes(w);
  d.bold(true).size(false, true).cols("TOTAL", fmt(data.grandTotal), w).size(false, false).bold(false);
  d.dashes(w).align("C").line("Thank you!").line("Visit us again soon").line("Powered by banaoo.in");
}

export interface KitchenSlipPayload {
  orderNumber: string;  orderType: "dine_in" | "takeaway";
  tableNumber?: string;
  items: Array<{ name: string; quantity: number }>;
  createdAt: Date;
}

export interface BillingReceiptPayload {
  orderNumber: string;
  outletName: string;
  gstNumber?: string | null;
  orderType: "dine_in" | "takeaway";
  tableNumber?: string;
  items: Array<{ name: string; quantity: number; totalPrice: number; gstRate?: number }>;
  subtotal: number;
  discountAmt: number;
  discountPercent?: number;
  serviceTax: number;
  serviceTaxPercent: number;
  gstTotal: number;
  grandTotal: number;
  createdAt: Date;
}

export function buildKitchenSlip(
  data: KitchenSlipPayload,
  paperWidth: 58 | 80 = 58,
  fontSize = 12,
  options?: EscPosPrintOptions
): Uint8Array {
  const w = columns(paperWidth);
  const d = new EscPosDoc().init();
  const condensed = fontSize <= 11;
  d.font(condensed);
  const feed = clampPostPrintFeed(options?.postPrintFeedLines);
  const showCut = options?.showTearCutLine !== false;
  const dual = options?.dualKitchenCopies === true;

  if (!dual) {
    writeKitchenSlipBody(d, data, w);
    d.align("C").line("-- Kitchen Copy --");
    if (showCut) appendTearCutLine(d, w);
    d.feed(feed).cut();
    return d.bytes();
  }

  writeKitchenSlipBody(d, data, w);
  d.align("C").bold(true).line("* KITCHEN COPY *").bold(false);
  if (showCut) appendTearCutLine(d, w);

  writeKitchenSlipBody(d, data, w);
  const secondLabel = data.orderType === "takeaway" ? "* PARCEL COPY *" : "* TABLE COPY *";
  d.align("C").bold(true).line(secondLabel).bold(false);
  if (showCut) appendTearCutLine(d, w);
  d.feed(feed).cut();
  return d.bytes();
}

export function buildBillingReceipt(
  data: BillingReceiptPayload,
  paperWidth: 58 | 80 = 58,
  fontSize = 12,
  options?: EscPosPrintOptions
): Uint8Array {
  const w = columns(paperWidth);
  const d = new EscPosDoc().init();
  const condensed = fontSize <= 11;
  d.font(condensed);
  const fmt = (n: number) => `Rs.${n.toFixed(2)}`;
  const feed = clampPostPrintFeed(options?.postPrintFeedLines);
  const showCut = options?.showTearCutLine !== false;
  const dual = options?.dualBillingCopies === true;

  if (!dual) {
    writeBillingReceiptBody(d, data, w, fmt);
    if (showCut) appendTearCutLine(d, w);
    d.feed(feed).cut();
    return d.bytes();
  }

  d.align("C").bold(true).line("*** COUNTER COPY ***").bold(false);
  writeBillingReceiptBody(d, data, w, fmt);
  if (showCut) appendTearCutLine(d, w);

  d.align("C").bold(true).line("*** CUSTOMER COPY ***").bold(false);
  writeBillingReceiptBody(d, data, w, fmt);
  if (showCut) appendTearCutLine(d, w);
  d.feed(feed).cut();
  return d.bytes();
}

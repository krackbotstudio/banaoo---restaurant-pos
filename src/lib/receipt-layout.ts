/** Shared thermal receipt column layout (web + native ESC/POS builders). */

export interface ReceiptLayoutConfig {
  columns: number;
  columnOffset: number;
  amountColumnWidth: number;
  boldTotalLine: boolean;
}

export const DEFAULT_RECEIPT_LAYOUT: ReceiptLayoutConfig = {
  columns: 32,
  columnOffset: 0,
  amountColumnWidth: 10,
  boldTotalLine: false,
};

export function clampColumnOffset(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.min(4, Math.max(0, Math.round(n)));
}

export function clampAmountColumnWidth(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 10;
  return Math.min(14, Math.max(8, Math.round(n)));
}

export function receiptLayoutFromFields(
  columns: number,
  fields?: {
    columnOffset?: number;
    amountColumnWidth?: number;
    boldTotalLine?: boolean;
  }
): ReceiptLayoutConfig {
  return {
    columns: Math.max(16, Math.round(columns)),
    columnOffset: clampColumnOffset(fields?.columnOffset),
    amountColumnWidth: clampAmountColumnWidth(fields?.amountColumnWidth),
    boldTotalLine: fields?.boldTotalLine === true,
  };
}

export function effectiveColumns(layout: ReceiptLayoutConfig): number {
  return Math.max(16, layout.columns - layout.columnOffset);
}

export function formatMoney(n: number): string {
  return `Rs.${n.toFixed(2)}`;
}

function withOffset(line: string, layout: ReceiptLayoutConfig): string {
  if (layout.columnOffset <= 0) return line;
  const w = effectiveColumns(layout);
  const trimmed = line.length > w ? line.slice(0, w) : line;
  return " ".repeat(layout.columnOffset) + trimmed;
}

/** Left / right aligned row within effective width. */
export function colsLine(left: string, right: string, layout: ReceiptLayoutConfig): string {
  const w = effectiveColumns(layout);
  const pad = Math.max(1, w - left.length - right.length);
  return withOffset(left + " ".repeat(pad) + right, layout);
}

/** Item row: name, qty, optional amount (fixed-width amount column on the right). */
export function formatItemLine(
  name: string,
  quantity: number,
  amount: number | null,
  layout: ReceiptLayoutConfig
): string {
  const w = effectiveColumns(layout);
  const qtyStr = `x${quantity}`;
  if (amount == null) {
    const maxName = Math.max(4, w - qtyStr.length - 1);
    const trimmed =
      name.length > maxName ? `${name.slice(0, maxName - 1)}.` : name;
    const pad = Math.max(1, w - trimmed.length - qtyStr.length);
    return withOffset(trimmed + " ".repeat(pad) + qtyStr, layout);
  }

  const amtStr = formatMoney(amount);
  const amtW = Math.min(layout.amountColumnWidth, w - qtyStr.length - 4);
  const maxName = Math.max(4, w - qtyStr.length - amtW - 1);
  const trimmed = name.length > maxName ? `${name.slice(0, maxName - 1)}.` : name;
  const leftPart = `${trimmed} ${qtyStr}`;
  const pad = Math.max(1, w - leftPart.length - amtStr.length);
  return withOffset(leftPart + " ".repeat(pad) + amtStr, layout);
}

export function truncateCenter(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + ".";
}

/** ASCII-only time for thermal printers (avoids U+202F etc. from toLocaleTimeString). */
export function formatReceiptTime(d: Date): string {
  const h24 = d.getHours();
  const m = d.getMinutes();
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** ASCII-only date + time for billing receipts. */
export function formatReceiptDateTime(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year} ${formatReceiptTime(d)}`;
}

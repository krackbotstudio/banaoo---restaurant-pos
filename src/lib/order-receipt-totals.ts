export interface ReceiptLineItem {
  totalPrice: number;
  gstRate?: number;
}

export interface ReceiptTotals {
  subtotal: number;
  gstTotal: number;
  grandTotal: number;
}

/** GST per line from item totals (no discount/service tax). */
export function computeReceiptTotals(items: ReceiptLineItem[]): ReceiptTotals {
  const subtotal = Math.round(items.reduce((s, i) => s + i.totalPrice, 0) * 100) / 100;
  const gstTotal = Math.round(
    items.reduce(
      (s, i) =>
        s + (i.gstRate ? (i.totalPrice * i.gstRate) / 100 : 0),
      0
    ) * 100
  ) / 100;
  const grandTotal = Math.round((subtotal + gstTotal) * 100) / 100;
  return { subtotal, gstTotal, grandTotal };
}

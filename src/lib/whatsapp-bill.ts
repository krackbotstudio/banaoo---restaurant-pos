/** Build WhatsApp deep links for order bills and customer messages. */

export function normalizeWhatsAppPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function formatOrderBillMessage(opts: {
  restaurantName: string;
  outletName?: string;
  orderNumber: string;
  orderType?: string;
  tableNumber?: string;
  items: { name: string; quantity: number; totalPrice?: number }[];
  subtotal?: number;
  gstTotal?: number;
  grandTotal: number;
  createdAt?: Date;
}): string {
  const lines: string[] = [];
  const title = opts.outletName
    ? `${opts.restaurantName} — ${opts.outletName}`
    : opts.restaurantName;
  lines.push(`🧾 *Bill from ${title}*`);
  lines.push(`Order #${opts.orderNumber}`);
  if (opts.tableNumber) lines.push(`Table: T${opts.tableNumber}`);
  else if (opts.orderType === "takeaway") lines.push("Takeaway");
  lines.push("");
  for (const item of opts.items) {
    const lineTotal =
      item.totalPrice != null
        ? ` — ₹${item.totalPrice.toLocaleString("en-IN")}`
        : "";
    lines.push(`• ${item.name} ×${item.quantity}${lineTotal}`);
  }
  lines.push("");
  if (opts.subtotal != null && opts.gstTotal != null && opts.gstTotal > 0) {
    lines.push(`Subtotal: ₹${opts.subtotal.toLocaleString("en-IN")}`);
    lines.push(`GST: ₹${opts.gstTotal.toLocaleString("en-IN")}`);
  }
  lines.push(`*Total: ₹${opts.grandTotal.toLocaleString("en-IN")}*`);
  if (opts.createdAt) {
    lines.push(
      "",
      opts.createdAt.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    );
  }
  lines.push("", "Thank you for dining with us!");
  return lines.join("\n");
}

export function openWhatsAppChat(phone: string, message: string): void {
  const normalized = normalizeWhatsAppPhone(phone);
  const base = normalized
    ? `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(base, "_blank", "noopener,noreferrer");
}

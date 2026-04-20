import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format, startOfDay, endOfDay, isToday, subDays, formatISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useOutlet } from "@/lib/outlet-context";
import { usePrinterSettings } from "@/lib/use-printer-settings";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { FloorPlanModal } from "@/components/floor-plan/FloorPlanModal";
import { Loader2, Plus, ShoppingCart, Clock, CheckCircle, XCircle, ChefHat, MapPin, User, Utensils, Package, Printer, ArrowLeft, PlusCircle, Minus, Trash2, Banknote, CalendarDays, ChevronLeft, ChevronRight, ArrowLeftRight } from "lucide-react";
import { PlatformBadge } from "@/components/integrations";
import { useToast } from "@/hooks/use-toast";
import { toast } from "sonner";
import { buildBillingReceipt, printViaSerial } from "@/lib/serial-printer";
import { isNativePrinterBridgeExpected, openNativePrinterSettings, postNativeBillingPrint } from "@/lib/native-print-bridge";

interface Order {
  id: string;
  order_number: string;
  status: "pending" | "preparing" | "ready" | "completed" | "cancelled" | "paid";
  total: number;
  created_at: string;
  table_number: string | null;
  order_type: string;
  source: string;
  customer_name: string | null;
  delivery_address: string | null;
  order_items: { id: string }[];
}

type ItemStatus = "pending" | "preparing" | "ready" | "completed" | "cancelled";

interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: ItemStatus;
  batch_id: string;
  created_at: string;
  gst_rate: number;
}

interface BatchGroup {
  batchId: string;
  createdAt: string;
  items: OrderItem[];
}

// Derive overall order status from all item statuses.
// Priority (highest→lowest): pending > preparing > ready > completed
// Cancelled items are excluded from the calculation.
function deriveOrderStatus(items: OrderItem[]): Order["status"] {
  if (!items.length) return "pending";
  const active = items.filter((i) => i.status !== "cancelled");
  if (!active.length) return "cancelled";
  if (active.some((i) => i.status === "pending"))   return "pending";
  if (active.some((i) => i.status === "preparing")) return "preparing";
  if (active.some((i) => i.status === "ready"))     return "ready";
  return "completed";
}

// Group items by batch_id; fallback: each item is its own batch
function groupByBatch(items: OrderItem[]): BatchGroup[] {
  const map = new Map<string, BatchGroup>();
  const sorted = [...items].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  for (const item of sorted) {
    const key = item.batch_id || item.id;
    if (!map.has(key)) {
      map.set(key, { batchId: key, createdAt: item.created_at, items: [] });
    }
    map.get(key)!.items.push(item);
  }
  return Array.from(map.values());
}

const ITEM_STATUS_NEXT: Record<ItemStatus, ItemStatus | null> = {
  pending:   "preparing",
  preparing: "ready",
  cancelled: null,
  ready:     "completed",
  completed: null,
};

const ITEM_STATUS_LABEL: Record<ItemStatus, string> = {
  pending:   "Pending",
  preparing: "Preparing",
  cancelled: "Cancelled",
  ready:     "Ready",
  completed: "Done",
};

const ITEM_STATUS_STYLE: Record<ItemStatus, string> = {
  pending:   "bg-yellow-100 text-yellow-700 border-yellow-200",
  preparing: "bg-blue-100 text-blue-700 border-blue-200",
  cancelled: "bg-red-100 text-red-500 border-red-200",
  ready:     "bg-green-100 text-green-700 border-green-200",
  completed: "bg-purple-100 text-purple-700 border-purple-200",
};

export default function Orders() {
  const { currentOutlet, outlets, loading: outletLoading } = useOutlet();
  const { settings: printerSettings } = usePrinterSettings(currentOutlet?.id);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<Date>(new Date());

  // Order detail sheet
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [printingBill, setPrintingBill] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  // Discount: value + type toggle (% or ₹). Tax: always %
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [tax, setTax] = useState(0); // always percentage
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Change Table dialog
  const [showChangeTable, setShowChangeTable] = useState(false);

  useEffect(() => {
    if (currentOutlet) {
      fetchOrders(dateFilter);

      // Subscribe to realtime updates
      const channel = supabase
        .channel('orders-page')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `outlet_id=eq.${currentOutlet.id}`
          },
          () => {
            fetchOrders(dateFilter);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentOutlet, dateFilter]);

  const fetchOrders = async (date: Date = dateFilter) => {
    if (!currentOutlet) return;
    setLoading(true);
    const dayStart = formatISO(startOfDay(date));
    const dayEnd   = formatISO(endOfDay(date));
    const { data, error } = await supabase
      .from("orders")
      .select(`
        id,
        order_number,
        status,
        total,
        created_at,
        table_number,
        order_type,
        source,
        customer_name,
        delivery_address,
        order_items (id)
      `)
      .eq("outlet_id", currentOutlet.id)
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setOrders(data as Order[]);
    }
    setLoading(false);
  };

  const openOrderDetail = async (order: Order) => {
    setSelectedOrder(order);
    setOrderItems([]);
    setDiscount(0);
    setDiscountType("percent");
    setTax(0);
    setItemsLoading(true);
    const { data } = await supabase
      .from("order_items")
      .select("id, item_name, quantity, unit_price, total_price, status, batch_id, created_at, gst_rate")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true });
    // Normalise: if status/gst_rate column doesn't exist yet, fall back to defaults
    const normalised = (data || []).map((row: any) => ({
      ...row,
      status: (row.status ?? "pending") as ItemStatus,
      batch_id: row.batch_id ?? row.id,
      created_at: row.created_at ?? new Date().toISOString(),
      gst_rate: row.gst_rate ?? 0,
    }));

    // For items missing gst_rate (old orders), resolve from current menu item config
    const hasMissingRates = normalised.some((i) => !i.gst_rate) && currentOutlet?.gst_categories;
    if (hasMissingRates && currentOutlet?.id) {
      const itemNames = [...new Set(normalised.filter((i) => !i.gst_rate).map((i) => i.item_name))];
      const { data: menuData } = await supabase
        .from("menu_items")
        .select("name, gst_category")
        .eq("outlet_id", currentOutlet.id)
        .in("name", itemNames);

      if (menuData && menuData.length > 0) {
        const gstRates = currentOutlet.gst_categories as Record<string, number> | null;
        const menuMap: Record<string, string | null> = {};
        menuData.forEach((m: any) => { menuMap[m.name] = m.gst_category; });
        const resolved = normalised.map((item) => {
          if (item.gst_rate) return item;
          const category = menuMap[item.item_name];
          const rate = category && gstRates ? (gstRates[category] ?? 0) : 0;
          return { ...item, gst_rate: rate };
        });
        setOrderItems(resolved);
      } else {
        setOrderItems(normalised);
      }
    } else {
      setOrderItems(normalised);
    }

    // Auto-correct: if order is cancelled, make sure ALL items are also cancelled
    if (order.status === "cancelled") {
      const hasNonCancelled = normalised.some((i) => i.status !== "cancelled");
      if (hasNonCancelled) {
        await supabase.from("order_items").update({ status: "cancelled" }).eq("order_id", order.id);
        setOrderItems(normalised.map((i) => ({ ...i, status: "cancelled" as ItemStatus })));
        setItemsLoading(false);
        return;
      }
    }

    // Auto-correct stale order status for active orders: if items say something different, fix it
    if (normalised.length > 0 && order.status !== "paid") {
      const correctStatus = deriveOrderStatus(normalised);
      if (correctStatus !== order.status) {
        await supabase.from("orders").update({ status: correctStatus }).eq("id", order.id);
        setSelectedOrder((prev) => prev ? { ...prev, status: correctStatus } : prev);
        setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, status: correctStatus } : o));
      }
    }

    setItemsLoading(false);
  };

  const handleChangeTable = async (_tableId: string, tableNumber: string) => {
    if (!selectedOrder) return;
    const { error } = await supabase
      .from("orders")
      .update({ table_number: tableNumber })
      .eq("id", selectedOrder.id);

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      const updated = { ...selectedOrder, table_number: tableNumber };
      setSelectedOrder(updated);
      setOrders((prev) => prev.map((o) => o.id === selectedOrder.id ? updated : o));
      toast({ title: "Table changed", description: `Order moved to Table ${tableNumber}` });
      setShowChangeTable(false);
    }
  };

  const refreshItems = async (orderId: string) => {
    const { data } = await supabase
      .from("order_items")
      .select("id, item_name, quantity, unit_price, total_price, status, batch_id, created_at, gst_rate")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });
    const normalised = (data || []).map((row: any) => ({
      ...row,
      status: (row.status ?? "pending") as ItemStatus,
      batch_id: row.batch_id ?? row.id,
      created_at: row.created_at ?? new Date().toISOString(),
      gst_rate: row.gst_rate ?? 0,
    }));
    setOrderItems(normalised);
    return normalised;
  };

  // Update a single item's status and recompute order-level status
  const handleItemStatusUpdate = async (itemId: string, newStatus: ItemStatus) => {
    setEditingItemId(itemId);
    await supabase.from("order_items").update({ status: newStatus }).eq("id", itemId);
    const updated = await refreshItems(selectedOrder!.id);
    const derivedStatus = deriveOrderStatus(updated);
    await supabase.from("orders").update({ status: derivedStatus }).eq("id", selectedOrder!.id);
    setSelectedOrder((prev) => prev ? { ...prev, status: derivedStatus } : prev);
    setEditingItemId(null);
  };

  // Edit item quantity (only when order is pending)
  const handleItemQtyChange = async (item: OrderItem, delta: number) => {
    const newQty = item.quantity + delta;
    if (newQty < 1) return;
    const newTotal = item.unit_price * newQty;
    setEditingItemId(item.id);
    await supabase.from("order_items").update({ quantity: newQty, total_price: newTotal }).eq("id", item.id);
    const updated = await refreshItems(selectedOrder!.id);
    const newOrderTotal = updated.reduce((s, i) => s + i.total_price, 0);
    await supabase.from("orders").update({ total: newOrderTotal, subtotal: newOrderTotal }).eq("id", selectedOrder!.id);
    setSelectedOrder((prev) => prev ? { ...prev, total: newOrderTotal } : prev);
    setEditingItemId(null);
  };

  // Remove an item (only when order is pending)
  const handleRemoveItem = async (itemId: string) => {
    setEditingItemId(itemId);
    await supabase.from("order_items").delete().eq("id", itemId);
    const updated = await refreshItems(selectedOrder!.id);
    const newOrderTotal = updated.reduce((s, i) => s + i.total_price, 0);
    await supabase.from("orders").update({ total: newOrderTotal, subtotal: newOrderTotal }).eq("id", selectedOrder!.id);
    setSelectedOrder((prev) => prev ? { ...prev, total: newOrderTotal } : prev);
    setEditingItemId(null);
  };

  const handleStatusUpdate = async (newStatus: Order["status"]) => {
    if (!selectedOrder) return;
    setUpdatingStatus(true);

    const subtotal = selectedOrder.total;
    const discountAmt = discountType === "percent"
      ? Math.round((subtotal * discount) / 100 * 100) / 100
      : discount;
    const taxable = Math.max(0, subtotal - discountAmt);
    const discountRatio = subtotal > 0 ? taxable / subtotal : 1;
    const itemGst = orderItems.reduce((sum, item) => {
      if (!item.gst_rate) return sum;
      return sum + Math.round(item.total_price * discountRatio * item.gst_rate / 100 * 100) / 100;
    }, 0);
    const taxAmt  = Math.round((taxable * tax) / 100 * 100) / 100;
    const finalTotal = newStatus === "paid"
      ? Math.round(Math.max(0, taxable + itemGst + taxAmt) * 100) / 100
      : subtotal;

    const { error } = await supabase
      .from("orders")
      .update({
        status: newStatus,
        ...(newStatus === "paid" ? { discount: discountAmt, tax: Math.round((itemGst + taxAmt) * 100) / 100, total: finalTotal } : {}),
      })
      .eq("id", selectedOrder.id);

    if (!error) {
      // Status rank: items can only move FORWARD, never backward.
      // Only update items whose current status is strictly behind the target.
      const STATUS_RANK: Record<ItemStatus, number> = {
        pending: 0, preparing: 1, ready: 2, completed: 3, cancelled: -1,
      };

      const itemStatus: ItemStatus =
        newStatus === "paid"      ? "completed" :
        newStatus === "cancelled" ? "cancelled" :
        newStatus as ItemStatus;

      if (newStatus === "cancelled") {
        // Cancellation: mark all non-completed items as cancelled
        await supabase
          .from("order_items")
          .update({ status: "cancelled" })
          .eq("order_id", selectedOrder.id)
          .neq("status", "completed");
      } else {
        // Only advance items that are strictly behind the target status
        const eligibleStatuses = (Object.keys(STATUS_RANK) as ItemStatus[])
          .filter((s) => STATUS_RANK[s] >= 0 && STATUS_RANK[s] < STATUS_RANK[itemStatus]);
        if (eligibleStatuses.length > 0) {
          await supabase
            .from("order_items")
            .update({ status: itemStatus })
            .eq("order_id", selectedOrder.id)
            .in("status", eligibleStatuses);
        }
      }
      await refreshItems(selectedOrder.id);
    }

    setUpdatingStatus(false);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      setSelectedOrder((prev) => prev ? { ...prev, status: newStatus } : prev);
      setOrders((prev) =>
        prev.map((o) => o.id === selectedOrder.id ? { ...o, status: newStatus } : o)
      );
      if (newStatus === "paid") {
        toast({
          title: "✅ Order Paid!",
          description: `Table ${selectedOrder.table_number || ""} is now free for new orders.`,
        });
        setSelectedOrder(null);
      } else {
        toast({ title: "Status updated", description: `Order marked as ${newStatus}` });
      }
    }
  };

  const handlePrintBill = async () => {
    if (!selectedOrder || printingBill) return;
    setPrintingBill(true);
    try {

    const pw = printerSettings.billingPrinter.paperWidth;
    const pt = printerSettings.billingPrinter.fontSize;
    const fmt = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
    const subtotal = selectedOrder.total;
    const discountAmt = discountType === "percent"
      ? Math.round(subtotal * discount / 100 * 100) / 100
      : discount;
    const taxable = Math.max(0, subtotal - discountAmt);
    const ratio = subtotal > 0 ? taxable / subtotal : 1;
    const gstTotal = orderItems.reduce((sum, item) =>
      sum + (item.gst_rate ? Math.round(item.total_price * ratio * item.gst_rate / 100 * 100) / 100 : 0), 0);
    const serviceTax = Math.round(taxable * tax / 100 * 100) / 100;
    const grandTotal = Math.round(Math.max(0, taxable + gstTotal + serviceTax) * 100) / 100;
    const discountPercent = discountType === "percent" ? discount : undefined;

    const postedToNative = postNativeBillingPrint({
      outletId: currentOutlet?.id,
      paperWidth: pw,
      orderNumber: selectedOrder.order_number,
      outletName: currentOutlet?.name || "",
      gstNumber: (currentOutlet as any)?.gst_number,
      orderType: selectedOrder.order_type === "dine_in" ? "dine_in" : "takeaway",
      tableNumber: selectedOrder.table_number || undefined,
      items: orderItems.map((i) => ({
        name: i.item_name,
        quantity: i.quantity,
        totalPrice: i.total_price,
        gstRate: i.gst_rate || undefined,
      })),
      subtotal,
      discountAmt,
      discountPercent,
      serviceTax,
      serviceTaxPercent: tax,
      gstTotal,
      grandTotal,
      createdAt: new Date(selectedOrder.created_at).toISOString(),
    });
    if (postedToNative) {
      toast.success("Bill sent to native printer bridge");
      return;
    }
    if (isNativePrinterBridgeExpected()) {
      toast.error("Native printer bridge unavailable. Open Native Printer Settings and try again.");
      openNativePrinterSettings();
      return;
    }

    // If a billing port is assigned, always treat this as serial intent.
    const portIndex = printerSettings.billingPrinter.usbPortIndex;
    const shouldUseSerial = printerSettings.billingPrinter.printMode === "serial" || portIndex !== null;
    if (shouldUseSerial) {
      if (portIndex === null) {
        toast.error("Billing printer is set to Serial, but no port is assigned in Settings");
        return;
      }
      try {
        const bytes = buildBillingReceipt({
          orderNumber: selectedOrder.order_number,
          outletName: currentOutlet?.name || "",
          gstNumber: (currentOutlet as any)?.gst_number,
          orderType: selectedOrder.order_type === "dine_in" ? "dine_in" : "takeaway",
          tableNumber: selectedOrder.table_number || undefined,
          items: orderItems.map((i) => ({
            name: i.item_name,
            quantity: i.quantity,
            totalPrice: i.total_price,
            gstRate: i.gst_rate || undefined,
          })),
          subtotal,
          discountAmt,
          discountPercent,
          serviceTax,
          serviceTaxPercent: tax,
          gstTotal,
          grandTotal,
          createdAt: new Date(selectedOrder.created_at),
        }, pw);
        await printViaSerial(portIndex, bytes, printerSettings.billingPrinter.baudRate);
        toast.success("Bill printed");
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`Billing serial print failed: ${msg}`);
        return;
      }
    }

    const dateStr = new Date(selectedOrder.created_at).toLocaleString("en-IN", {
      day: "2-digit", month: "2-digit", year: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });

    const itemRows = orderItems.map((item) => {
      const gstAmt = item.gst_rate
        ? Math.round(item.total_price * ratio * item.gst_rate / 100 * 100) / 100
        : 0;
      return `
        <tr>
          <td style="padding:2px 3px 2px 0">${item.item_name}</td>
          <td style="text-align:center;padding:2px">${item.quantity}</td>
          <td style="text-align:right;padding:2px 0">&#8377;${fmt(item.total_price)}</td>
        </tr>${item.gst_rate && gstAmt > 0 ? `
        <tr style="font-size:${pt - 2}pt">
          <td colspan="2" style="padding-left:4px">+ GST @${item.gst_rate}%</td>
          <td style="text-align:right">&#8377;${fmt(gstAmt)}</td>
        </tr>` : ""}`;
    }).join("");

    const gstNumber = (currentOutlet as any)?.gst_number;
    const printWindow = window.open("", "_blank", "width=220,height=650");
    if (!printWindow) {
      toast.error("Allow popups to use browser print mode");
      return;
    }

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="color-scheme" content="light"/>
  <title>Bill #${selectedOrder.order_number}</title>
  <style>
    @page { size: ${pw}mm auto; margin: 0; }
    html, body { margin:0; padding:3mm 2mm; width:${pw}mm; background:#fff; color:#000;
      font-family:'Courier New',Courier,monospace; font-size:${pt}pt; }
    * { color:#000 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    table { border-collapse:collapse; width:100%; }
    .dash { border-top:1px dashed #000; margin:4px 0; }
    .solid { border-top:1px solid #000; margin:3px 0; }
    .center { text-align:center; }
    .bold { font-weight:bold; }
    .right { text-align:right; }
  </style>
</head>
<body>
  <div class="center bold" style="font-size:${pt + 2}pt;margin-bottom:1mm">${currentOutlet?.name || ""}</div>
  ${gstNumber ? `<div class="center" style="font-size:${pt - 2}pt;margin-bottom:2mm">GSTIN: ${gstNumber}</div>` : ""}
  <div class="dash"></div>
  <table style="font-size:${pt - 1}pt">
    <tr><td>Order #</td><td class="right bold">${selectedOrder.order_number}</td></tr>
    <tr><td>Date</td><td class="right">${dateStr}</td></tr>
    <tr><td>Type</td><td class="right bold">${selectedOrder.order_type === "dine_in" ? "DINE IN" : "TAKEAWAY"}</td></tr>
    ${selectedOrder.order_type === "dine_in" && selectedOrder.table_number
      ? `<tr><td>Table</td><td class="right bold">${selectedOrder.table_number}</td></tr>` : ""}
  </table>
  <div class="dash"></div>
  <table>
    <thead><tr class="bold" style="font-size:${pt - 1}pt">
      <td style="width:50%">ITEM</td>
      <td style="width:10%;text-align:center">QTY</td>
      <td style="width:40%;text-align:right">AMT</td>
    </tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div class="dash"></div>
  <table style="font-size:${pt - 1}pt">
    <tr><td>Subtotal</td><td class="right">&#8377;${fmt(subtotal)}</td></tr>
    ${discountAmt > 0 ? `<tr><td>Discount${discountType === "percent" ? ` (${discount}%)` : ""}</td><td class="right">- &#8377;${fmt(discountAmt)}</td></tr>` : ""}
    ${serviceTax > 0 ? `<tr><td>Service Tax (${tax}%)</td><td class="right">+ &#8377;${fmt(serviceTax)}</td></tr>` : ""}
    <tr><td colspan="2"><div class="solid"></div></td></tr>
    <tr class="bold" style="font-size:${pt + 2}pt"><td>TOTAL</td><td class="right">&#8377;${fmt(grandTotal)}</td></tr>
  </table>
  <div class="dash"></div>
  <div class="center" style="font-size:${pt - 1}pt;margin-top:2mm;line-height:1.6">
    <div class="bold">Thank you!</div>
    <div>Visit us again soon</div>
    <div style="margin-top:2mm;font-size:10pt">Powered by banaoo.in</div>
  </div>
  <div style="height:10mm"></div>
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 400);
    } finally {
      setPrintingBill(false);
    }
  };

  // "paid" is NOT in the auto-flow; it's reached via the explicit "Mark as Paid" button
  const STATUS_FLOW: Order["status"][] = ["pending", "preparing", "ready", "completed"];
  const nextStatus = (current: Order["status"]): Order["status"] | null => {
    const idx = STATUS_FLOW.indexOf(current);
    return idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
  };
  const nextStatusLabel: Record<string, string> = {
    pending: "Mark Preparing",
    preparing: "Mark Ready",
    ready: "Mark Completed",
  };

  const ORDER_STATUS_LABEL: Record<Order["status"], string> = {
    pending:   "Pending",
    preparing: "Preparing",
    ready:     "Ready",
    completed: "Awaiting Payment",
    paid:      "Paid",
    cancelled: "Cancelled",
  };

  const getStatusIcon = (status: Order["status"]) => {
    switch (status) {
      case "pending":   return <Clock className="h-4 w-4" />;
      case "preparing": return <ChefHat className="h-4 w-4" />;
      case "ready":     return <CheckCircle className="h-4 w-4" />;
      case "completed": return <CheckCircle className="h-4 w-4" />;
      case "paid":      return <Banknote className="h-4 w-4" />;
      case "cancelled": return <XCircle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: Order["status"]) => {
    switch (status) {
      case "pending":   return "bg-yellow-500/20 text-yellow-500 border-yellow-500/30";
      case "preparing": return "bg-blue-500/20 text-blue-500 border-blue-500/30";
      case "ready":     return "bg-green-500/20 text-green-500 border-green-500/30";
      case "completed": return "bg-purple-500/20 text-purple-600 border-purple-500/30";
      case "paid":      return "bg-emerald-500/20 text-emerald-600 border-emerald-400/40";
      case "cancelled": return "bg-red-500/20 text-red-500 border-red-500/30";
      default:          return "bg-muted text-muted-foreground";
    }
  };

  if (outletLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (outlets.length === 0) {
    return (
      <AppLayout>
        <div className="p-6 max-w-7xl mx-auto">
          <EmptyState
            icon={ShoppingCart}
            title="No Outlets Found"
            description="Create an outlet first before managing orders"
            actionLabel="Go to Outlets"
            onAction={() => window.location.href = "/outlets"}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl gradient-primary glow-primary">
              <ShoppingCart className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">Orders</h1>
              <p className="text-sm text-muted-foreground">
                {currentOutlet?.name ? `${currentOutlet.name} - ` : ""}Manage and track customer orders
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button asChild className="gradient-primary glow-primary h-10">
              <Link to="/orders/new">
                <Plus className="h-4 w-4 mr-2" />
                New Order
              </Link>
            </Button>
          </div>
        </div>

        {/* Date Filter */}
        {(() => {
          const isTodaySelected = isToday(dateFilter);
          const isYesterday = !isTodaySelected &&
            format(dateFilter, "yyyy-MM-dd") === format(subDays(new Date(), 1), "yyyy-MM-dd");
          const label = isTodaySelected ? "Today" : isYesterday ? "Yesterday" : format(dateFilter, "dd MMM yyyy");
          return (
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
              <button
                onClick={() => setDateFilter(d => subDays(d, 1))}
                className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                title="Previous day"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => (dateInputRef.current as any)?.showPicker?.() ?? dateInputRef.current?.click()}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  isTodaySelected
                    ? "bg-primary text-white border-primary"
                    : "bg-background border-border hover:bg-muted"
                }`}
              >
                {label}
              </button>
              <input
                ref={dateInputRef}
                type="date"
                max={format(new Date(), "yyyy-MM-dd")}
                value={format(dateFilter, "yyyy-MM-dd")}
                onChange={(e) => e.target.value && setDateFilter(new Date(e.target.value + "T00:00:00"))}
                className="sr-only"
                tabIndex={-1}
              />
              <button
                onClick={() => setDateFilter(d => { const n = subDays(d, -1); return n > new Date() ? new Date() : n; })}
                disabled={isTodaySelected}
                className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Next day"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              {!isTodaySelected && (
                <button
                  onClick={() => setDateFilter(new Date())}
                  className="text-xs text-primary underline underline-offset-2 ml-1"
                >
                  Back to Today
                </button>
              )}
            </div>
          );
        })()}

        {/* Filter Tabs */}
        <div className="space-y-3">
          {/* Source Filter */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground self-center mr-2">Source:</span>
            {["all", "pos", "zomato", "swiggy"].map((source) => (
              <Button
                key={source}
                variant={sourceFilter === source ? "secondary" : "outline"}
                size="sm"
                className="rounded-full capitalize"
                onClick={() => setSourceFilter(source)}
              >
                {source === "all" ? "All Sources" : source.toUpperCase()}
              </Button>
            ))}
          </div>
          
          {/* Status Filter */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground self-center mr-2">Status:</span>
            {["all", "pending", "preparing", "ready", "completed", "paid"].map((status) => (
              <Button
                key={status}
                variant={filter === status ? "secondary" : "outline"}
                size="sm"
                className="rounded-full capitalize"
                onClick={() => setFilter(status)}
              >
                {status === "all" ? "All Status" : status}
              </Button>
            ))}
          </div>
        </div>

        {/* Orders List */}
        {(() => {
          const RUNNING = new Set(["pending", "preparing", "ready", "completed"]);
          let filteredOrders = orders;
          
          if (sourceFilter !== "all") {
            filteredOrders = filteredOrders.filter(o => o.source === sourceFilter);
          }
          if (filter !== "all") {
            filteredOrders = filteredOrders.filter(o => o.status === filter);
          }

          if (filteredOrders.length === 0) {
            return (
              <EmptyState
                icon={ShoppingCart}
                title={filter === "all" && sourceFilter === "all" ? "No Orders Yet" : "No matching orders"}
                description="Start taking orders from your customers"
                actionLabel="Create New Order"
                onAction={() => window.location.href = "/orders/new"}
              />
            );
          }

          const runningOrders = filteredOrders.filter(o => RUNNING.has(o.status));
          const doneOrders    = filteredOrders.filter(o => !RUNNING.has(o.status));

          const OrderGrid = ({ list }: { list: Order[] }) => (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {list.map((order) => (
              <Card key={order.id} onClick={() => openOrderDetail(order)} className={`group hover:border-primary/50 transition-all duration-300 cursor-pointer relative ${
                order.source === 'zomato' ? 'border-l-4 border-l-red-500' : 
                order.source === 'swiggy' ? 'border-l-4 border-l-orange-500' : ''
              }`}>
                {/* Live dot for active orders */}
                {(order.status === "pending" || order.status === "preparing" || order.status === "ready") && (
                  <span className="absolute top-3 right-3 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                      order.status === "pending" ? "bg-yellow-500" :
                      order.status === "preparing" ? "bg-blue-500" : "bg-green-500"
                    }`} />
                  </span>
                )}
                <CardHeader className="pb-3 pr-8">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {/* Primary: Table / Takeaway / Delivery */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className={`flex items-center gap-1.5 font-bold text-xl font-display ${
                          order.order_type === "dine_in" ? "text-primary" : "text-orange-500"
                        }`}>
                          {order.order_type === "dine_in" ? (
                            <>
                              <Utensils className="h-5 w-5 shrink-0" />
                              <span>Table {order.table_number || "—"}</span>
                            </>
                          ) : order.order_type === "delivery" ? (
                            <>
                              <MapPin className="h-5 w-5 shrink-0" />
                              <span>Delivery</span>
                            </>
                          ) : (
                            <>
                              <Package className="h-5 w-5 shrink-0" />
                              <span>Takeaway</span>
                            </>
                          )}
                        </div>
                        {order.source !== 'pos' && <PlatformBadge source={order.source} />}
                      </div>
                      {/* Secondary: order number as reference */}
                      <p className="text-xs text-muted-foreground mt-0.5">#{order.order_number}</p>
                    </div>
                    <Badge variant="outline" className={`${getStatusColor(order.status)} flex items-center gap-1.5 shrink-0`}>
                      {getStatusIcon(order.status)}
                      <span>{ORDER_STATUS_LABEL[order.status]}</span>
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Customer info for delivery orders */}
                  {order.source !== 'pos' && order.customer_name && (
                    <div className="mb-3 p-2 rounded-lg bg-muted/50 space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="truncate">{order.customer_name}</span>
                      </div>
                      {order.delivery_address && (
                        <div className="flex items-start gap-2 text-xs text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{order.delivery_address}</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {order.order_items.length} items
                    </div>
                    <div className="text-lg font-bold text-primary">₹{order.total}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
            </div>
          );

          return (
            <div className="space-y-6">
              {runningOrders.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                      Live Orders
                    </span>
                    <span className="flex h-2 w-2 relative ml-1">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                    </span>
                    <span className="text-xs text-muted-foreground">({runningOrders.length})</span>
                  </div>
                  <OrderGrid list={runningOrders} />
                </div>
              )}

              {runningOrders.length > 0 && doneOrders.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground shrink-0">Paid & Cancelled</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}

              {doneOrders.length > 0 && (
                <div className="space-y-3">
                  {runningOrders.length === 0 && (
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Paid & Cancelled
                    </span>
                  )}
                  <OrderGrid list={doneOrders} />
                </div>
              )}
            </div>
          );
        })()}
      </div>
      {/* ── Order Detail Sheet ── */}
      <Sheet open={!!selectedOrder} onOpenChange={(open) => { if (!open) setSelectedOrder(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0 [&>button.absolute]:hidden">
          {selectedOrder && (
            <>
              {/* Header */}
              <SheetHeader className="px-4 pt-4 pb-4 border-b border-border/50 shrink-0">
                {/* Top row: back arrow + title + status badge */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="shrink-0 h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                    aria-label="Close"
                  >
                    <ArrowLeft className="h-5 w-5 text-foreground" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <SheetTitle className={`text-xl font-bold font-display flex items-center gap-1.5 leading-tight ${
                      selectedOrder.order_type === "dine_in" ? "text-primary" : "text-orange-500"
                    }`}>
                      {selectedOrder.order_type === "dine_in" ? (
                        <Utensils className="h-5 w-5 shrink-0" />
                      ) : selectedOrder.order_type === "delivery" ? (
                        <MapPin className="h-5 w-5 shrink-0" />
                      ) : (
                        <Package className="h-5 w-5 shrink-0" />
                      )}
                      <span>
                        {selectedOrder.order_type === "dine_in"
                          ? `Table ${selectedOrder.table_number || "—"}`
                          : selectedOrder.order_type === "delivery"
                          ? "Delivery"
                          : "Takeaway"}
                      </span>
                    </SheetTitle>
                    <p className="text-xs text-muted-foreground mt-0.5 text-left">#{selectedOrder.order_number}</p>
                  </div>
                  <Badge variant="outline" className={`${getStatusColor(selectedOrder.status)} flex items-center gap-1.5 shrink-0`}>
                    {getStatusIcon(selectedOrder.status)}
                    <span>{ORDER_STATUS_LABEL[selectedOrder.status]}</span>
                  </Badge>
                </div>

                {/* Customer info */}
                {selectedOrder.customer_name && (
                  <div className="mt-3 p-3 rounded-xl bg-muted/50 space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium">{selectedOrder.customer_name}</span>
                    </div>
                    {selectedOrder.delivery_address && (
                      <div className="flex items-start gap-2 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>{selectedOrder.delivery_address}</span>
                      </div>
                    )}
                  </div>
                )}
              </SheetHeader>

              {/* Items */}
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {itemsLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : orderItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No items found</p>
                ) : (
                  <div className="space-y-1">
                    {groupByBatch(orderItems).map((batch, batchIdx) => (
                      <div key={batch.batchId}>
                        {/* Batch divider */}
                        <div className="flex items-center gap-2 py-2">
                          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                            {batchIdx === 0 ? "Order Items" : `Added Items`}
                          </span>
                          <div className="flex-1 h-px bg-border/50" />
                          <span className="text-[11px] text-muted-foreground">
                            {format(new Date(batch.createdAt), "h:mm a")}
                          </span>
                        </div>

                        {/* Items in this batch */}
                        {batch.items.map((item) => {
                          // Each item is editable until it is individually started (status moves off "pending")
                          const canEdit = item.status === "pending" && selectedOrder!.status !== "cancelled" && selectedOrder!.status !== "paid";
                          const nextStatus = ITEM_STATUS_NEXT[item.status];
                          const isUpdating = editingItemId === item.id;
                          return (
                            <div key={item.id} className="rounded-xl border border-border/50 bg-card p-3 mb-2">
                              {/* Row 1: qty, name, price */}
                              <div className="flex items-start gap-2">
                                <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                                  {item.quantity}×
                                </span>
                                <span className="font-medium text-sm flex-1 leading-tight">{item.item_name}</span>
                                <span className="font-semibold text-sm text-primary shrink-0">₹{item.total_price}</span>
                              </div>

                              {/* Row 2: controls */}
                              <div className="flex items-center justify-between mt-2 gap-2">
                                {/* Per-item status badge */}
                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${ITEM_STATUS_STYLE[item.status]}`}>
                                  {ITEM_STATUS_LABEL[item.status]}
                                </span>

                                <div className="flex items-center gap-1 ml-auto">
                                  {/* Qty edit — only when order is pending */}
                                  {canEdit && (
                                    <>
                                      <button
                                        onClick={() => handleItemQtyChange(item, -1)}
                                        disabled={isUpdating || item.quantity <= 1}
                                        className="h-6 w-6 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-40"
                                      >
                                        <Minus className="h-3 w-3" />
                                      </button>
                                      <span className="w-5 text-center text-xs font-bold">{item.quantity}</span>
                                      <button
                                        onClick={() => handleItemQtyChange(item, 1)}
                                        disabled={isUpdating}
                                        className="h-6 w-6 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-40"
                                      >
                                        <Plus className="h-3 w-3" />
                                      </button>
                                      <button
                                        onClick={() => handleRemoveItem(item.id)}
                                        disabled={isUpdating}
                                        className="h-6 w-6 rounded-full border border-border flex items-center justify-center text-destructive/60 hover:border-destructive hover:text-destructive disabled:opacity-40 ml-1"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </>
                                  )}

                                  {/* Per-item status advance — visible for all active orders */}
                                  {selectedOrder!.status !== "cancelled" && selectedOrder!.status !== "paid" && nextStatus && (
                                    <button
                                      onClick={() => handleItemStatusUpdate(item.id, nextStatus)}
                                      disabled={isUpdating}
                                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors disabled:opacity-50 text-white
                                        ${nextStatus === "ready" ? "bg-green-500 hover:bg-green-600" : nextStatus === "completed" ? "bg-gray-500 hover:bg-gray-600" : "bg-blue-500 hover:bg-blue-600"}`}
                                    >
                                      {isUpdating
                                        ? <Loader2 className="h-3 w-3 animate-spin" />
                                        : <span className="flex items-center gap-0.5">
                                            {nextStatus === "preparing" ? "Start" : nextStatus === "ready" ? "Mark Ready" : "Complete"}
                                            <ChevronRight className="h-3 w-3" />
                                          </span>
                                      }
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer: total + actions */}
              <div className="border-t border-border/50 px-5 py-4 bg-card shrink-0 space-y-3">

                {/* ── Bill summary: subtotal, discount, per-item GST, additional tax, payable ── */}
                {selectedOrder.status !== "cancelled" && (() => {
                  const subtotal = selectedOrder.total;
                  const discountAmt = discountType === "percent"
                    ? Math.round((subtotal * discount) / 100 * 100) / 100
                    : discount;
                  const discountPct = discountType === "percent"
                    ? discount
                    : subtotal > 0 ? Math.round((discount / subtotal) * 10000) / 100 : 0;
                  const discountRatio = subtotal > 0 ? Math.max(0, subtotal - discountAmt) / subtotal : 1;

                  // Per-item GST: group by rate slab, computed on discounted item price
                  const gstSlabMap: Record<number, number> = {};
                  let totalItemGst = 0;
                  orderItems.forEach(item => {
                    if (!item.gst_rate) return;
                    const discountedPrice = Math.round(item.total_price * discountRatio * 100) / 100;
                    const gstAmt = Math.round(discountedPrice * item.gst_rate / 100 * 100) / 100;
                    gstSlabMap[item.gst_rate] = Math.round(((gstSlabMap[item.gst_rate] ?? 0) + gstAmt) * 100) / 100;
                    totalItemGst += gstAmt;
                  });
                  totalItemGst = Math.round(totalItemGst * 100) / 100;
                  const hasItemGst = totalItemGst > 0;

                  const taxable  = Math.max(0, subtotal - discountAmt);
                  const taxAmt   = Math.round((taxable * tax) / 100 * 100) / 100;
                  const payable  = Math.round(Math.max(0, taxable + totalItemGst + taxAmt) * 100) / 100;
                  return (
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2">
                      {/* Subtotal */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-medium">₹{subtotal}</span>
                      </div>

                      {/* Discount row */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-muted-foreground w-16 shrink-0">Discount</span>
                        <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
                          <button
                            className={`px-3 py-1.5 text-sm font-bold transition-colors ${discountType === "percent" ? "bg-primary text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
                            disabled={selectedOrder.status === "paid"}
                            onClick={() => setDiscountType("percent")}
                          >%</button>
                          <button
                            className={`px-3 py-1.5 text-sm font-bold transition-colors ${discountType === "amount" ? "bg-primary text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
                            disabled={selectedOrder.status === "paid"}
                            onClick={() => setDiscountType("amount")}
                          >₹</button>
                        </div>
                        <input
                          type="number" min={0}
                          max={discountType === "percent" ? 100 : undefined}
                          value={discount === 0 ? "" : discount} placeholder="0"
                          disabled={selectedOrder.status === "paid"}
                          onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-16 text-center text-sm font-medium bg-background border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-sm text-red-500 font-medium w-16 text-right shrink-0">
                          {discountAmt > 0 ? `-₹${discountAmt}` : ""}
                        </span>
                      </div>

                      {/* Per-item GST breakdown */}
                      {hasItemGst && (
                        <div className="space-y-1 pt-1 border-t border-border/30">
                          {Object.entries(gstSlabMap).sort(([a],[b]) => Number(a)-Number(b)).map(([rate, amt]) => (
                            <div key={rate} className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>GST @{rate}%</span>
                              <span className="text-emerald-600 font-medium">+₹{amt.toFixed(2)}</span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between text-xs font-semibold text-emerald-700">
                            <span>Total GST</span>
                            <span>+₹{totalItemGst.toFixed(2)}</span>
                          </div>
                        </div>
                      )}

                      {/* Additional Tax row (for cess / manual override) */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-muted-foreground w-24 shrink-0">Service Tax</span>
                        <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
                          <span className="px-3 py-1.5 text-sm font-bold bg-muted text-muted-foreground">%</span>
                        </div>
                        <input
                          type="number" min={0} max={100}
                          value={tax === 0 ? "" : tax} placeholder="0"
                          disabled={selectedOrder.status === "paid"}
                          onChange={(e) => setTax(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-16 text-center text-sm font-medium bg-background border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-sm text-emerald-600 font-medium w-16 text-right shrink-0">
                          {taxAmt > 0 ? `+₹${taxAmt}` : ""}
                        </span>
                      </div>

                      {/* Total payable */}
                      <div className="flex items-center justify-between pt-1.5 border-t border-border/50">
                        <span className="font-semibold text-sm">Total Payable</span>
                        <span className="text-xl font-bold text-primary">₹{payable}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Add Items */}
                {selectedOrder.status !== "cancelled" && selectedOrder.status !== "paid" && (
                  <Button
                    className="w-full h-11 gap-2 font-medium bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20"
                    variant="ghost"
                    onClick={() => {
                      setSelectedOrder(null);
                      const params = new URLSearchParams({
                        addTo: selectedOrder.id,
                        table: selectedOrder.table_number || "",
                        type: selectedOrder.order_type,
                      });
                      navigate(`/orders/new?${params.toString()}`);
                    }}
                  >
                    <PlusCircle className="h-4 w-4" />
                    Add Items
                  </Button>
                )}

                {/* Change Table — only for active dine-in orders */}
                {selectedOrder.order_type === "dine_in" && selectedOrder.status !== "cancelled" && selectedOrder.status !== "paid" && (
                  <Button
                    variant="outline"
                    className="w-full h-11 gap-2 font-medium border-border"
                    onClick={() => setShowChangeTable(true)}
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    Change Table
                  </Button>
                )}

                {/* Print Bill — hidden for cancelled orders */}
                {selectedOrder.status !== "cancelled" && <Button
                  variant="outline"
                  className="w-full h-11 gap-2 font-medium border-border"
                  disabled={itemsLoading || printingBill}
                  onClick={handlePrintBill}
                >
                  {printingBill ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                  {printingBill ? "Printing..." : "Print Bill"}
                </Button>}

                {/* Progress: pending→preparing→ready→completed */}
                {nextStatus(selectedOrder.status) && (
                  <Button
                    className="w-full h-12 gradient-primary text-white font-semibold rounded-xl"
                    disabled={updatingStatus}
                    onClick={() => handleStatusUpdate(nextStatus(selectedOrder.status)!)}
                  >
                    {updatingStatus ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {nextStatusLabel[selectedOrder.status]}
                  </Button>
                )}

                {/* Mark as Paid */}
                {selectedOrder.status === "completed" && (
                  <Button
                    className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl gap-2"
                    disabled={updatingStatus}
                    onClick={() => handleStatusUpdate("paid")}
                  >
                    {updatingStatus
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Banknote className="h-5 w-5" />}
                    {selectedOrder.order_type === "dine_in" ? "Mark as Paid — Table Free" : "Mark as Paid"}
                  </Button>
                )}

                {/* Cancel Order */}
                {selectedOrder.status !== "cancelled" && selectedOrder.status !== "paid" && (
                  <Button
                    variant="outline"
                    className="w-full h-10 text-destructive border-destructive/30 hover:bg-destructive/10"
                    disabled={updatingStatus}
                    onClick={() => handleStatusUpdate("cancelled")}
                  >
                    Cancel Order
                  </Button>
                )}
              </div>

            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Change Table — reuse the full floor-plan picker ── */}
      {currentOutlet && (
        <FloorPlanModal
          open={showChangeTable}
          onOpenChange={setShowChangeTable}
          outletId={currentOutlet.id}
          onSelectTable={handleChangeTable}
        />
      )}
    </AppLayout>
  );
}
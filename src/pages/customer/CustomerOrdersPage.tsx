import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCustomer } from "@/context/customer-context";
import { Loader2, ClipboardList, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface CustomerOrder {
  id: string;
  order_number: string;
  status: string;
  order_type: string;
  table_number: string | null;
  total: number;
  created_at: string;
  notes: string | null;
  order_items: OrderItem[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; pulse?: boolean }> = {
  pending:   { label: "Order Received",  color: "text-yellow-700", bg: "bg-yellow-100", pulse: true },
  preparing: { label: "Being Prepared",  color: "text-blue-700",   bg: "bg-blue-100",   pulse: true },
  ready:     { label: "Ready to Pick Up",color: "text-green-700",  bg: "bg-green-100",  pulse: true },
  completed: { label: "Completed",       color: "text-gray-600",   bg: "bg-gray-100" },
  cancelled: { label: "Cancelled",       color: "text-red-700",    bg: "bg-red-100" },
};

const ORDER_TYPE_LABEL: Record<string, string> = {
  dine_in:  "Dine In",
  takeaway: "Takeaway",
  delivery: "Delivery",
};

function fmtCurrency(v: number) {
  return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function fmtTime(s: string) {
  return new Date(s).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function isToday(s: string) {
  const d = new Date(s);
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export default function CustomerOrdersPage({ outletId }: { outletId: string }) {
  const { customer } = useCustomer();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchOrders = useCallback(async (silent = false) => {
    if (!customer?.phone) { setLoading(false); return; }
    if (silent) setRefreshing(true);
    else setLoading(true);

    const { data, error } = await db
      .from("orders")
      .select("id, order_number, status, order_type, table_number, total, created_at, notes, order_items(id, item_name, quantity, unit_price, total_price)")
      .eq("outlet_id", outletId)
      .eq("customer_phone", customer.phone)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!error && data) {
      setOrders(data as CustomerOrder[]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [customer?.phone, outletId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Auto-refresh every 15s if there are active orders
  useEffect(() => {
    const hasActive = orders.some((o) =>
      ["pending", "preparing", "ready"].includes(o.status)
    );
    if (!hasActive) return;
    const interval = setInterval(() => fetchOrders(true), 15000);
    return () => clearInterval(interval);
  }, [orders, fetchOrders]);

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 px-6 text-center text-gray-400">
        <ClipboardList className="h-12 w-12" />
        <p className="text-sm">Sign in to see your orders</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 px-6 text-center text-gray-400">
        <ClipboardList className="h-12 w-12" />
        <p className="text-sm font-medium text-gray-500">No orders yet</p>
        <p className="text-xs">Your orders from this restaurant will appear here</p>
      </div>
    );
  }

  const activeOrders = orders.filter((o) => ["pending", "preparing", "ready"].includes(o.status));
  const pastOrders = orders.filter((o) => ["completed", "cancelled"].includes(o.status));

  return (
    <div className="px-4 py-4 space-y-4 pb-8">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-base text-gray-900">Your Orders</h2>
        <button
          onClick={() => fetchOrders(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-primary font-medium py-1.5 px-3 rounded-full bg-primary/10 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Active Orders */}
      {activeOrders.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Live Orders</p>
          {activeOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              expanded={expandedId === order.id}
              onToggle={() => setExpandedId(expandedId === order.id ? null : order.id)}
            />
          ))}
        </div>
      )}

      {/* Past Orders */}
      {pastOrders.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Past Orders</p>
          {pastOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              expanded={expandedId === order.id}
              onToggle={() => setExpandedId(expandedId === order.id ? null : order.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({
  order,
  expanded,
  onToggle,
}: {
  order: CustomerOrder;
  expanded: boolean;
  onToggle: () => void;
}) {
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const isActive = ["pending", "preparing", "ready"].includes(order.status);

  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
        isActive ? "border-primary/30" : "border-gray-100"
      }`}
    >
      {/* Status bar */}
      <div className={`${cfg.bg} px-4 py-2 flex items-center gap-2`}>
        {cfg.pulse && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
        )}
        <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
      </div>

      {/* Main row */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-gray-900">#{order.order_number}</span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-500">{ORDER_TYPE_LABEL[order.order_type] || order.order_type}</span>
            {order.order_type === "dine_in" && order.table_number && (
              <>
                <span className="text-xs text-gray-400">·</span>
                <span className="text-xs text-gray-500">Table {order.table_number}</span>
              </>
            )}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {isToday(order.created_at) ? `Today, ${fmtTime(order.created_at)}` : `${fmtDate(order.created_at)}, ${fmtTime(order.created_at)}`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-gray-900">{fmtCurrency(order.total)}</span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded items */}
      {expanded && (
        <div className="border-t border-gray-50 px-4 py-3 space-y-1.5 bg-gray-50/50">
          {order.order_items.length === 0 ? (
            <p className="text-xs text-gray-400">No item details available</p>
          ) : (
            <>
              {order.order_items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {item.quantity}× {item.item_name}
                  </span>
                  <span className="text-gray-900 font-medium">{fmtCurrency(item.total_price)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-2 mt-1">
                <span>Total</span>
                <span>{fmtCurrency(order.total)}</span>
              </div>
            </>
          )}
          {order.notes && (
            <p className="text-xs text-gray-500 pt-1 border-t border-gray-100">
              Note: {order.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

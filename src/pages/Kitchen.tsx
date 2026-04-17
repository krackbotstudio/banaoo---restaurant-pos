import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOutlet } from "@/lib/outlet-context";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Loader2, ChefHat, CheckCircle, Timer, Volume2, VolumeX, Truck, Utensils, Package, MapPin, ChevronRight, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNotificationSound } from "@/hooks/use-notification-sound";
import { PlatformBadge } from "@/components/integrations";

type ItemStatus = "pending" | "preparing" | "ready" | "completed" | "cancelled";

const ITEM_STATUS_NEXT: Record<ItemStatus, ItemStatus | null> = {
  pending:   "preparing",
  preparing: "ready",
  ready:     "completed",
  completed: null,
  cancelled: null,
};

const ITEM_STATUS_STYLE: Record<ItemStatus, string> = {
  pending:   "bg-yellow-100 text-yellow-700 border-yellow-300",
  preparing: "bg-blue-100 text-blue-700 border-blue-300",
  ready:     "bg-green-100 text-green-700 border-green-300",
  completed: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-red-100 text-red-500 border-red-200",
};

interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  notes: string | null;
  status: ItemStatus;
}

interface KitchenOrder {
  id: string;
  order_number: string;
  status: string;
  order_type: string;
  table_number: string | null;
  created_at: string;
  source: string;
  customer_name: string | null;
  order_items: OrderItem[];
}

export default function Kitchen() {
  const { currentOutlet, outlets, loading: outletLoading } = useOutlet();
  const { toast } = useToast();
  const { playSound } = useNotificationSound();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [updatingItem, setUpdatingItem] = useState<string | null>(null);
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const printKitchenSlip = (order: KitchenOrder) => {
    const time = new Date(order.created_at).toLocaleTimeString("en-IN", {
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
    const typeLabel = order.order_type === "dine_in"
      ? `Table T${order.table_number || "—"}`
      : order.order_type === "delivery" ? "Delivery" : "Takeaway";

    const itemRows = order.order_items
      .filter((i) => i.status !== "cancelled")
      .map((item) => `
        <tr>
          <td style="padding-top:2mm;padding-right:2mm">${item.item_name}</td>
          <td style="text-align:right;padding-top:2mm;font-weight:bold;font-size:12pt">x${item.quantity}</td>
        </tr>`)
      .join("");

    const printWindow = window.open("", "_blank", "width=220,height=500");
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Kitchen #${order.order_number}</title>
  <style>
    @page { size: 58mm auto; margin: 0; }
    html, body { margin:0; padding:0; width:58mm; background:#fff;
      font-family:'Courier New',Courier,monospace; font-size:10pt; color:#000; }
    table { border-collapse:collapse; width:100%; }
    .dash { border-top:1px dashed #000; margin:3px 0; }
  </style>
</head>
<body>
  <div style="text-align:center;font-weight:bold;margin-bottom:2mm">** KITCHEN ORDER **</div>
  <div class="dash"></div>
  <table>
    <tr><td style="font-weight:bold">Order #</td><td style="text-align:right;font-weight:bold">${order.order_number}</td></tr>
    <tr><td>Time</td><td style="text-align:right">${time}</td></tr>
    <tr><td style="font-weight:bold">${order.order_type === "dine_in" ? "Table" : "Type"}</td>
        <td style="text-align:right;font-weight:bold">${typeLabel}</td></tr>
  </table>
  <div class="dash"></div>
  <table>
    <thead><tr style="font-weight:bold"><td>ITEM</td><td style="text-align:right">QTY</td></tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div class="dash"></div>
  <div style="text-align:center;font-size:8pt;margin-top:1mm">— Kitchen Copy —</div>
  <div style="height:8mm"></div>
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 400);
  };

  useEffect(() => {
    if (currentOutlet) {
      fetchOrders();
      
      // Subscribe to realtime updates
      const channel = supabase
        .channel('kitchen-orders')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'orders',
            filter: `outlet_id=eq.${currentOutlet.id}`
          },
          (payload) => {
            // Play sound and show toast for new orders
            if (soundEnabled) {
              playSound();
            }
            toast({
              title: "🔔 New Order!",
              description: `Order #${payload.new.order_number} just came in`,
            });
            fetchOrders();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `outlet_id=eq.${currentOutlet.id}`
          },
          () => {
            fetchOrders();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentOutlet, soundEnabled, playSound]);

  // Tick every second so elapsed timers stay live
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const fetchOrders = async () => {
    if (!currentOutlet) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select(`
        id,
        order_number,
        status,
        order_type,
        table_number,
        created_at,
        source,
        customer_name,
        order_items (
          id,
          item_name,
          quantity,
          notes,
          status
        )
      `)
      .eq("outlet_id", currentOutlet.id)
      .in("status", ["pending", "preparing", "ready"])
      .order("created_at", { ascending: true });

    if (!error && data) {
      setOrders(data as KitchenOrder[]);
    }
    setLoading(false);
  };

  const getElapsed = (createdAt: string) => {
    const totalSecs = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return { mins, secs, totalSecs };
  };

  const getElapsedColor = (mins: number) => {
    if (mins <= 5)  return "text-green-500";
    if (mins <= 10) return "text-yellow-500";
    return "text-red-500";
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setUpdatingOrder(orderId);
    // Also bulk-update all items to match
    await supabase.from("order_items").update({ status: newStatus }).eq("order_id", orderId);
    const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      fetchOrders();
    }
    setUpdatingOrder(null);
  };

  const updateItemStatus = async (orderId: string, itemId: string, newItemStatus: ItemStatus) => {
    setUpdatingItem(itemId);
    await supabase.from("order_items").update({ status: newItemStatus }).eq("id", itemId);

    // Re-derive order status from all sibling items
    const { data: items } = await supabase
      .from("order_items")
      .select("status")
      .eq("order_id", orderId);

    if (items && items.length > 0) {
      const statuses = items.map((i: any) => i.status as ItemStatus);
      let derivedOrderStatus: string;
      if (statuses.every(s => s === "completed")) derivedOrderStatus = "completed";
      else if (statuses.every(s => s === "ready" || s === "completed")) derivedOrderStatus = "ready";
      else if (statuses.some(s => s === "preparing")) derivedOrderStatus = "preparing";
      else derivedOrderStatus = "pending";
      await supabase.from("orders").update({ status: derivedOrderStatus }).eq("id", orderId);
    }

    fetchOrders();
    setUpdatingItem(null);
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
            icon={ChefHat}
            title="No Outlets Found"
            description="Create an outlet first to use the kitchen display"
            actionLabel="Go to Outlets"
            onAction={() => window.location.href = "/outlets"}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-full mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl gradient-accent glow-accent">
              <ChefHat className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">Kitchen Display</h1>
              <p className="text-sm text-muted-foreground">
                {currentOutlet?.name ? `${currentOutlet.name} - ` : ""}Real-time order queue
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant={soundEnabled ? "secondary" : "outline"}
              size="icon"
              className="h-10 w-10"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Mute notifications" : "Enable notifications"}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4 text-primary" />
              ) : (
                <VolumeX className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>

        {/* Status Legend */}
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="text-muted-foreground">Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-muted-foreground">Preparing</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-muted-foreground">Ready</span>
          </div>
        </div>

        {/* Orders Grid */}
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-6 rounded-full bg-muted/30 mb-6">
              <ChefHat className="h-16 w-16 text-muted-foreground/50" />
            </div>
            <h2 className="font-display text-2xl font-semibold mb-2">No Active Orders</h2>
            <p className="text-muted-foreground max-w-md">
              When customers place orders, they'll appear here in real-time for the kitchen to prepare.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {orders.map((order) => {
              // `tick` is read here so React re-renders this row every second
              void tick;
              const { mins, secs } = getElapsed(order.created_at);
              return (
                <Card
                  key={order.id}
                  className={`overflow-hidden border-t-4 ${
                    order.status === "pending"
                      ? "border-t-yellow-500"
                      : order.status === "preparing"
                      ? "border-t-blue-500"
                      : "border-t-green-500"
                  }`}
                >
                  <CardHeader className="pb-3">
                    {/* Top row: type label + timer */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {/* Prominent type badge */}
                        <div className={`inline-flex items-center gap-1.5 font-bold text-lg leading-tight ${
                          order.order_type === "dine_in"
                            ? "text-primary"
                            : order.order_type === "delivery"
                            ? "text-purple-500"
                            : "text-orange-500"
                        }`}>
                          {order.order_type === "dine_in" ? (
                            <><Utensils className="h-5 w-5 shrink-0" /> Table {order.table_number || "—"}</>
                          ) : order.order_type === "delivery" ? (
                            <><MapPin className="h-5 w-5 shrink-0" /> Delivery</>
                          ) : (
                            <><Package className="h-5 w-5 shrink-0" /> Takeaway</>
                          )}
                        </div>
                        {/* Order number + platform badge below */}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs text-muted-foreground font-mono">#{order.order_number}</span>
                          {order.source !== 'pos' && <PlatformBadge source={order.source} />}
                        </div>
                        {/* Customer name for delivery */}
                        {order.order_type === "delivery" && order.customer_name && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Truck className="h-3 w-3 shrink-0" />
                            {order.customer_name}
                          </p>
                        )}
                      </div>
                      <div className={`flex items-center gap-1 text-sm font-semibold shrink-0 tabular-nums ${getElapsedColor(mins)}`}>
                        <Timer className="h-4 w-4" />
                        {mins}m {String(secs).padStart(2, "0")}s
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Order Items with per-item status */}
                    <div className="space-y-2">
                      {order.order_items.map((item) => {
                        const itemStatus = (item.status ?? "pending") as ItemStatus;
                        const nextItemStatus = ITEM_STATUS_NEXT[itemStatus];
                        const isUpdating = updatingItem === item.id;
                        return (
                          <div key={item.id} className="rounded-lg border border-border/60 bg-muted/20 p-2.5 space-y-1.5">
                            {/* Item name + qty */}
                            <div className="flex items-start gap-2">
                              <span className="font-bold text-primary shrink-0">{item.quantity}×</span>
                              <div className="flex-1 min-w-0">
                                <span className="font-medium">{item.item_name}</span>
                                {item.notes && (
                                  <p className="text-xs text-muted-foreground">{item.notes}</p>
                                )}
                              </div>
                            </div>
                            {/* Status badge + advance button */}
                            <div className="flex items-center gap-2">
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border capitalize ${ITEM_STATUS_STYLE[itemStatus]}`}>
                                {itemStatus}
                              </span>
                              {nextItemStatus && itemStatus !== "completed" && (
                                <button
                                  disabled={isUpdating}
                                  onClick={() => updateItemStatus(order.id, item.id, nextItemStatus)}
                                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors disabled:opacity-50 ml-auto text-white ${
                                    nextItemStatus === "preparing" ? "bg-blue-500 hover:bg-blue-600" :
                                    nextItemStatus === "ready"     ? "bg-green-500 hover:bg-green-600" :
                                                                     "bg-gray-500 hover:bg-gray-600"
                                  }`}
                                >
                                  {isUpdating
                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                    : <span className="flex items-center gap-0.5">
                                        {nextItemStatus === "preparing" ? "Start" : nextItemStatus === "ready" ? "Mark Ready" : "Done"}
                                        <ChevronRight className="h-3 w-3" />
                                      </span>
                                  }
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Order-level action button */}
                    <div className="pt-1 border-t border-border/40 space-y-2">
                      {order.status === "pending" && (
                        <Button
                          className="w-full bg-blue-500 hover:bg-blue-600"
                          disabled={updatingOrder === order.id}
                          onClick={() => updateOrderStatus(order.id, "preparing")}
                        >
                          {updatingOrder === order.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Start All — Preparing
                        </Button>
                      )}
                      {order.status === "preparing" && (
                        <Button
                          className="w-full bg-green-500 hover:bg-green-600"
                          disabled={updatingOrder === order.id}
                          onClick={() => updateOrderStatus(order.id, "ready")}
                        >
                          {updatingOrder === order.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                          Mark All Ready
                        </Button>
                      )}
                      {order.status === "ready" && (
                        <Button
                          className="w-full"
                          variant="outline"
                          disabled={updatingOrder === order.id}
                          onClick={() => updateOrderStatus(order.id, "completed")}
                        >
                          {updatingOrder === order.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Complete All
                        </Button>
                      )}

                      {/* Print Kitchen Slip */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2 text-muted-foreground border-dashed"
                        onClick={() => printKitchenSlip(order)}
                      >
                        <Printer className="h-3.5 w-3.5" />
                        Print Kitchen Slip
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
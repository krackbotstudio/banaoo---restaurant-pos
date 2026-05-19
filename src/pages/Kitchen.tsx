import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOutlet } from "@/lib/outlet-context";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Loader2, ChefHat, CheckCircle, Timer, Volume2, VolumeX, Truck, Utensils, Package, MapPin, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  readKitchenSoundEnabled,
  useKitchenOrderSound,
  writeKitchenSoundEnabled,
} from "@/hooks/use-kitchen-order-sound";
import { PlatformBadge } from "@/components/integrations";
import { isNativePrinterBridgeExpected, openNativePrinterSettings, postNativeKitchenPrint } from "@/lib/native-print-bridge";
import { isSelfServiceMode, isOnlineOrderSource } from "@/lib/outlet-operation";
import { usePrinterSettings } from "@/lib/use-printer-settings";
import { printKitchenOrderSlip } from "@/lib/print-kitchen";

type ItemStatus = "pending" | "preparing" | "ready" | "completed" | "cancelled";

/** One-tap kitchen flow: cooking → done (leaves kitchen display). */
function getOrderAdvanceAction(orderStatus: string): {
  label: string;
  nextStatus: string;
  buttonClass: string;
} | null {
  if (orderStatus === "pending" || orderStatus === "preparing") {
    return {
      label: "Ready for pickup",
      nextStatus: "completed",
      buttonClass: "bg-green-600 hover:bg-green-700 text-white shadow-lg",
    };
  }
  return null;
}

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
  const { settings: printerSettings } = usePrinterSettings(currentOutlet?.id);
  const selfService = isSelfServiceMode(currentOutlet?.operation_mode);
  const { toast } = useToast();
  const { playSound, unlockAudio } = useKitchenOrderSound();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => readKitchenSoundEnabled());
  const audioUnlockedRef = useRef(false);
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const printKitchenSlip = (order: KitchenOrder) => {
    const orderType = order.order_type === "dine_in" ? "dine_in" : "takeaway";
    const postedToNative = postNativeKitchenPrint({
      outletId: currentOutlet?.id,
      orderNumber: order.order_number,
      orderType,
      tableNumber: order.table_number || undefined,
      items: order.order_items
        .filter((i) => i.status !== "cancelled")
        .map((i) => ({ name: i.item_name, quantity: i.quantity })),
      createdAt: new Date(order.created_at).toISOString(),
      source: order.source,
      selfServiceMode: selfService,
    });
    if (postedToNative) {
      toast({ title: "Kitchen slip sent to native printer bridge" });
      return;
    }
    if (isNativePrinterBridgeExpected()) {
      toast({ title: "Native printer bridge unavailable. Open Native Printer Settings and try again." });
      openNativePrinterSettings();
      return;
    }

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
          <td style="padding:3px 4px 3px 0;font-size:13pt">${item.item_name}</td>
          <td style="text-align:right;padding:3px 0;font-weight:bold;font-size:15pt">x${item.quantity}</td>
        </tr>`)
      .join("");

    const printWindow = window.open("", "_blank", "width=220,height=500");
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Kitchen #${order.order_number}</title>
  <meta name="color-scheme" content="light"/>
  <style>
    @page { size: 58mm auto; margin: 0; }
    html, body { margin:0; padding:0; width:58mm; background:#fff !important;
      font-family:'Courier New',Courier,monospace; font-size:13pt; color:#000 !important; }
    *, *::before, *::after { color:#000 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    table { border-collapse:collapse; width:100%; }
    .dash { border-top:1px dashed #000; margin:4px 0; }
  </style>
</head>
<body>
  <div style="text-align:center;font-weight:bold;font-size:15pt;margin-bottom:3mm">** KITCHEN ORDER **</div>
  <div class="dash"></div>
  <table>
    <tr><td style="font-weight:bold">Order #</td><td style="text-align:right;font-weight:bold">${order.order_number}</td></tr>
    <tr><td>Time</td><td style="text-align:right">${time}</td></tr>
    <tr><td style="font-weight:bold">${order.order_type === "dine_in" ? "Table" : "Type"}</td>
        <td style="text-align:right;font-weight:bold">${typeLabel}</td></tr>
  </table>
  <div class="dash"></div>
  <table>
    <thead><tr style="font-weight:bold;font-size:12pt"><td>ITEM</td><td style="text-align:right">QTY</td></tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div class="dash"></div>
  <div style="text-align:center;font-size:11pt;margin-top:2mm">— Kitchen Copy —</div>
  <div style="height:10mm"></div>
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 400);
  };

  // Unlock ringtone after first tap anywhere on Kitchen (browser autoplay policy)
  useEffect(() => {
    const onFirstInteraction = () => {
      if (audioUnlockedRef.current) return;
      audioUnlockedRef.current = true;
      void unlockAudio();
    };
    document.addEventListener("pointerdown", onFirstInteraction, { once: true });
    return () => document.removeEventListener("pointerdown", onFirstInteraction);
  }, [unlockAudio]);

  const handleSoundToggle = async () => {
    const next = !soundEnabled;
    if (next) {
      audioUnlockedRef.current = true;
      await unlockAudio();
    }
    setSoundEnabled(next);
    writeKitchenSoundEnabled(next);
  };

  useEffect(() => {
    if (currentOutlet) {
      fetchOrders();

      const channel = supabase
        .channel(`kitchen-orders-${currentOutlet.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "orders",
            filter: `outlet_id=eq.${currentOutlet.id}`,
          },
          async (payload) => {
            if (soundEnabled) {
              void playSound();
            }
            const row = payload.new as {
              id?: string;
              order_number?: string;
              source?: string;
              order_type?: string;
              table_number?: string | null;
              created_at?: string;
              total?: number;
            };
            toast({
              title: "🔔 New Order!",
              description: `Order #${row.order_number ?? "—"} just came in`,
            });
            fetchOrders();

            if (
              selfService &&
              isOnlineOrderSource(row.source) &&
              printerSettings.kitchenPrinter.autoPrint &&
              row.id &&
              row.order_number &&
              row.created_at
            ) {
              const { data: items } = await supabase
                .from("order_items")
                .select("item_name, quantity, status")
                .eq("order_id", row.id);
              const activeItems = (items || []).filter((i) => i.status !== "cancelled");
              if (activeItems.length > 0) {
                void printKitchenOrderSlip(printerSettings, {
                  outletId: currentOutlet?.id,
                  orderNumber: row.order_number,
                  orderType: row.order_type === "dine_in" ? "dine_in" : "takeaway",
                  tableNumber: row.table_number || undefined,
                  items: activeItems.map((i) => ({
                    name: i.item_name,
                    quantity: i.quantity,
                  })),
                  createdAt: new Date(row.created_at),
                  source: row.source,
                  selfServiceMode: true,
                });
              }
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "orders",
            filter: `outlet_id=eq.${currentOutlet.id}`,
          },
          () => {
            fetchOrders();
          }
        )
        .subscribe((status, err) => {
          if (status === "CHANNEL_ERROR") {
            console.error("Kitchen realtime subscription error:", err);
          }
        });

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentOutlet, soundEnabled, playSound, toast, selfService, printerSettings]);

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
      .in("status", ["pending", "preparing"])
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
    await supabase
      .from("order_items")
      .update({ status: newStatus })
      .eq("order_id", orderId)
      .neq("status", "cancelled");
    const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      fetchOrders();
    }
    setUpdatingOrder(null);
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
                {currentOutlet?.name ? `${currentOutlet.name} · ` : ""}
                Tap <span className="font-medium text-foreground">Ready for pickup</span> once — order leaves the kitchen
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant={soundEnabled ? "secondary" : "outline"}
              size="icon"
              className="h-10 w-10"
              onClick={() => void handleSoundToggle()}
              title={soundEnabled ? "Mute new-order ringtone" : "Enable new-order ringtone"}
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
        <div className="flex items-center gap-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500 shrink-0" />
            <span className="text-muted-foreground">
              Cooking — one tap on <span className="font-medium text-foreground">Ready for pickup</span> clears the card
            </span>
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
              const advance = getOrderAdvanceAction(order.status);
              const isUpdating = updatingOrder === order.id;
              return (
                <Card
                  key={order.id}
                  className={cn(
                    "overflow-hidden border-t-4",
                    "border-t-yellow-500"
                  )}
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
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-muted-foreground"
                          title="Print kitchen slip"
                          onClick={() => printKitchenSlip(order)}
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        <div className={`flex items-center gap-1 text-sm font-semibold tabular-nums ${getElapsedColor(mins)}`}>
                          <Timer className="h-4 w-4" />
                          {mins}m {String(secs).padStart(2, "0")}s
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-0 divide-y divide-border/40">
                      {order.order_items
                        .filter((item) => item.status !== "cancelled")
                        .map((item) => (
                          <div key={item.id} className="flex items-start gap-2 py-2 first:pt-0 last:pb-0">
                            <span className="font-bold text-lg text-primary shrink-0">{item.quantity}×</span>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-base leading-snug">{item.item_name}</span>
                              {item.notes && (
                                <p className="text-xs text-muted-foreground mt-0.5">{item.notes}</p>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>

                    {advance && (
                      <Button
                        type="button"
                        className={cn(
                          "w-full h-14 text-base font-bold rounded-xl",
                          advance.buttonClass
                        )}
                        disabled={isUpdating}
                        onClick={() => updateOrderStatus(order.id, advance.nextStatus)}
                      >
                        {isUpdating ? (
                          <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        ) : (
                          <CheckCircle className="h-5 w-5 mr-2" />
                        )}
                        {advance.label}
                      </Button>
                    )}
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
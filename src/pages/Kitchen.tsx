import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOutlet } from "@/lib/outlet-context";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Loader2, ChefHat, CheckCircle, Timer, Volume2, VolumeX, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNotificationSound } from "@/hooks/use-notification-sound";
import { PlatformBadge } from "@/components/integrations";

interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  notes: string | null;
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
          notes
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

  const getElapsedMinutes = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    return Math.floor((now.getTime() - created.getTime()) / 60000);
  };

  const getElapsedColor = (minutes: number) => {
    if (minutes <= 5) return "text-green-500";
    if (minutes <= 10) return "text-yellow-500";
    return "text-red-500";
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      fetchOrders();
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
              const elapsed = getElapsedMinutes(order.created_at);
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
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="font-display text-xl">#{order.order_number}</CardTitle>
                          {order.source !== 'pos' && <PlatformBadge source={order.source} />}
                        </div>
                        <CardDescription className="flex items-center gap-1">
                          {order.order_type === "dine_in" ? `Table ${order.table_number}` : 
                           order.order_type === "delivery" ? (
                            <>
                              <Truck className="h-3 w-3" />
                              {order.customer_name || "Delivery"}
                            </>
                           ) : "Takeaway"}
                        </CardDescription>
                      </div>
                      <div className={`flex items-center gap-1.5 text-sm font-medium ${getElapsedColor(elapsed)}`}>
                        <Timer className="h-4 w-4" />
                        {elapsed}m
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Order Items */}
                    <div className="space-y-2">
                      {order.order_items.map((item) => (
                        <div key={item.id} className="flex items-start gap-2">
                          <span className="font-bold text-primary">{item.quantity}×</span>
                          <div className="flex-1">
                            <span className="font-medium">{item.item_name}</span>
                            {item.notes && (
                              <p className="text-xs text-muted-foreground">{item.notes}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      {order.status === "pending" && (
                        <Button
                          className="flex-1 bg-blue-500 hover:bg-blue-600"
                          onClick={() => updateOrderStatus(order.id, "preparing")}
                        >
                          Start Preparing
                        </Button>
                      )}
                      {order.status === "preparing" && (
                        <Button
                          className="flex-1 bg-green-500 hover:bg-green-600"
                          onClick={() => updateOrderStatus(order.id, "ready")}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Mark Ready
                        </Button>
                      )}
                      {order.status === "ready" && (
                        <Button
                          className="flex-1"
                          variant="outline"
                          onClick={() => updateOrderStatus(order.id, "completed")}
                        >
                          Complete
                        </Button>
                      )}
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
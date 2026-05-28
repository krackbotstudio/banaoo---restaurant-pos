import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Box, LayoutGrid, ShoppingBag, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TableGridView,
  type TableActivatePayload,
} from "@/components/floor-plan/TableGridView";
import { TakeawayBagCard } from "./TakeawayBagCard";
import { OnlineOrderBox } from "./OnlineOrderBox";
import { cn } from "@/lib/utils";

export interface VisualOrder {
  id: string;
  order_number: string;
  status: "pending" | "preparing" | "ready" | "completed" | "paid" | "cancelled";
  total: number;
  table_number: string | null;
  order_type: string;
  source: string;
  customer_name: string | null;
  order_items: { id: string }[];
}

interface OrdersVisualHubProps {
  outletId: string;
  orders: VisualOrder[];
  onTableActivate: (payload: TableActivatePayload) => void;
  onTakeawayActivate: (order: VisualOrder | null) => void;
  onOnlineActivate: (order: VisualOrder) => void;
  className?: string;
}

const RUNNING = new Set(["pending", "preparing", "ready", "completed"]);

function isOnlineOrder(order: VisualOrder) {
  return order.source !== "pos" || order.order_type === "delivery";
}

function isTakeawayOrder(order: VisualOrder) {
  return order.order_type === "takeaway" && order.source === "pos";
}

function isDineInOrder(order: VisualOrder) {
  return order.order_type === "dine_in";
}

export function OrdersVisualHub({
  outletId,
  orders,
  onTableActivate,
  onTakeawayActivate,
  onOnlineActivate,
  className,
}: OrdersVisualHubProps) {
  const [activeTab, setActiveTab] = useState<"dine_in" | "takeaway" | "online">("dine_in");

  const dineInOrders = useMemo(
    () => orders.filter((o) => isDineInOrder(o) && RUNNING.has(o.status)),
    [orders]
  );
  const takeawayOrders = useMemo(
    () => orders.filter((o) => isTakeawayOrder(o) && RUNNING.has(o.status)),
    [orders]
  );
  const onlineOrders = useMemo(
    () => orders.filter((o) => isOnlineOrder(o) && RUNNING.has(o.status)),
    [orders]
  );

  return (
    <div className={cn("rounded-2xl border bg-card/50 overflow-hidden", className)}>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 pt-4 pb-2 border-b border-border/50 bg-muted/20">
          <div>
            <h2 className="text-sm font-semibold">Visual floor</h2>
            <p className="text-xs text-muted-foreground">
              Tap a table, bag, or box for quick actions
            </p>
          </div>
          <TabsList className="grid grid-cols-3 w-full sm:w-auto">
            <TabsTrigger value="dine_in" className="gap-1.5 text-xs sm:text-sm">
              <Utensils className="h-3.5 w-3.5" />
              Dine In
              {dineInOrders.length > 0 && (
                <span className="ml-1 rounded-full bg-primary/15 px-1.5 text-[10px] font-bold text-primary">
                  {dineInOrders.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="takeaway" className="gap-1.5 text-xs sm:text-sm">
              <ShoppingBag className="h-3.5 w-3.5" />
              Takeaway
              {takeawayOrders.length > 0 && (
                <span className="ml-1 rounded-full bg-orange-500/15 px-1.5 text-[10px] font-bold text-orange-600">
                  {takeawayOrders.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="online" className="gap-1.5 text-xs sm:text-sm">
              <Box className="h-3.5 w-3.5" />
              Online
              {onlineOrders.length > 0 && (
                <span className="ml-1 rounded-full bg-blue-500/15 px-1.5 text-[10px] font-bold text-blue-600">
                  {onlineOrders.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="dine_in" className="m-0 p-4 md:p-6">
          <TableGridView
            outletId={outletId}
            onTableActivate={onTableActivate}
            showStatusFilter
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground border-t pt-4">
            <span>Tap any table for actions — new order, add items, print bill, and more</span>
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
              <Link to={`/outlets/${outletId}`}>Edit floor plan</Link>
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="takeaway" className="m-0 p-4 md:p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            <TakeawayBagCard isNew onClick={() => onTakeawayActivate(null)} />
            {takeawayOrders.map((order) => (
              <TakeawayBagCard
                key={order.id}
                orderNumber={order.order_number}
                itemCount={order.order_items.length}
                total={order.total}
                status={order.status}
                onClick={() => onTakeawayActivate(order)}
              />
            ))}
          </div>
          {takeawayOrders.length === 0 && (
            <p className="text-center text-sm text-muted-foreground mt-6">
              Tap the empty bag to start a takeaway order
            </p>
          )}
        </TabsContent>

        <TabsContent value="online" className="m-0 p-6">
          {onlineOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="relative mb-4">
                <div className="h-16 w-20 rounded-md bg-gradient-to-b from-muted to-muted/60 border-2 border-border" />
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 h-4 w-[110%] rounded-sm bg-muted-foreground/20 border border-border" />
              </div>
              <p className="font-medium text-muted-foreground">No online orders right now</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Zomato, Swiggy, and delivery orders appear here
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {onlineOrders.map((order) => (
                <OnlineOrderBox
                  key={order.id}
                  orderNumber={order.order_number}
                  source={order.source}
                  customerName={order.customer_name}
                  itemCount={order.order_items.length}
                  total={order.total}
                  status={order.status}
                  onClick={() => onOnlineActivate(order)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="px-4 py-2 border-t bg-muted/10 flex items-center gap-2 text-[11px] text-muted-foreground">
        <LayoutGrid className="h-3.5 w-3.5" />
        Tap any spot for quick actions without leaving this page
      </div>
    </div>
  );
}

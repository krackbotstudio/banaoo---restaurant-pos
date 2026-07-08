import {
  Plus,
  Eye,
  PlusCircle,
  Printer,
  ChevronRight,
  Banknote,
  ArrowLeftRight,
  XCircle,
  Utensils,
  ShoppingBag,
  Box,
  Users,
  Clock,
  Truck,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { PlatformBadge } from "@/components/integrations";
import type { VisualOrder } from "./OrdersVisualHub";
import { cn } from "@/lib/utils";
import { canShipDeliveryOrder } from "@/lib/ship-order";

export type VisualSpotType = "table" | "takeaway" | "online";

export interface TableSpotInfo {
  tableId: string;
  tableNumber: string;
  seats: number;
  zone?: string;
  customerName?: string | null;
  reservedTime?: string | null;
  partySize?: number | null;
  tableStatus?: "available" | "occupied" | "reserved";
}

export interface VisualSpotContext {
  spotType: VisualSpotType;
  table?: TableSpotInfo;
  order?: VisualOrder | null;
}

interface VisualSpotActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: VisualSpotContext | null;
  statusLabel: Record<string, string>;
  statusColor: (status: string) => string;
  statusIcon: (status: string) => React.ReactNode;
  nextStatus: (status: VisualOrder["status"]) => VisualOrder["status"] | null;
  nextStatusLabel: Record<string, string>;
  onNewOrder: (ctx: VisualSpotContext) => void;
  onViewOrder: (order: VisualOrder) => void;
  onAddItems: (order: VisualOrder) => void;
  onPrintBill: (order: VisualOrder) => void;
  onAdvanceStatus: (order: VisualOrder) => void;
  onMarkPaid: (order: VisualOrder) => void;
  onChangeTable?: (order: VisualOrder) => void;
  onCancelOrder: (order: VisualOrder) => void;
  onConfirmShip?: (order: VisualOrder) => void;
  printingBill?: boolean;
  updatingStatus?: boolean;
  shippingOrder?: boolean;
}

function SpotIcon({ type }: { type: VisualSpotType }) {
  switch (type) {
    case "table":
      return <Utensils className="h-5 w-5" />;
    case "takeaway":
      return <ShoppingBag className="h-5 w-5" />;
    case "online":
      return <Box className="h-5 w-5" />;
  }
}

export function VisualSpotActionSheet({
  open,
  onOpenChange,
  context,
  statusLabel,
  statusColor,
  statusIcon,
  nextStatus,
  nextStatusLabel,
  onNewOrder,
  onViewOrder,
  onAddItems,
  onPrintBill,
  onAdvanceStatus,
  onMarkPaid,
  onChangeTable,
  onCancelOrder,
  onConfirmShip,
  printingBill,
  updatingStatus,
  shippingOrder,
}: VisualSpotActionSheetProps) {
  if (!context) return null;

  const { spotType, table, order } = context;
  const hasOrder = !!order;
  const isActive =
    hasOrder && order.status !== "paid" && order.status !== "cancelled";
  const next = order ? nextStatus(order.status) : null;
  const showShipAction =
    hasOrder &&
    (spotType === "online" || spotType === "takeaway") &&
    canShipDeliveryOrder(order!);

  const title =
    spotType === "table" && table
      ? `Table ${table.tableNumber}`
      : spotType === "takeaway"
        ? hasOrder
          ? `Takeaway #${order!.order_number}`
          : "New takeaway"
        : hasOrder
          ? `Online #${order!.order_number}`
          : "Online order";

  const subtitle =
    spotType === "table" && table
      ? `${table.seats} seats${table.zone ? ` · ${table.zone}` : ""}`
      : hasOrder && order.customer_name
        ? order.customer_name
        : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-5 pt-5 pb-4 border-b shrink-0 text-left">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                spotType === "table"
                  ? "bg-primary/10 text-primary"
                  : spotType === "takeaway"
                    ? "bg-orange-500/10 text-orange-600"
                    : "bg-blue-500/10 text-blue-600"
              )}
            >
              <SpotIcon type={spotType} />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-xl">{title}</SheetTitle>
              {subtitle && (
                <SheetDescription className="mt-0.5">{subtitle}</SheetDescription>
              )}
            </div>
          </div>

          {hasOrder && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <Badge
                variant="outline"
                className={cn("gap-1", statusColor(order!.status))}
              >
                {statusIcon(order!.status)}
                {statusLabel[order!.status]}
              </Badge>
              {order!.source !== "pos" && (
                <PlatformBadge source={order!.source} />
              )}
              <span className="text-sm font-semibold text-primary ml-auto">
                ₹{order!.total}
              </span>
            </div>
          )}

          {table?.tableStatus === "reserved" && !hasOrder && (
            <div className="mt-3 rounded-lg bg-orange-500/10 border border-orange-500/20 p-3 text-sm space-y-1">
              {table.customerName && (
                <p className="font-medium flex items-center gap-2">
                  <Users className="h-3.5 w-3.5" />
                  {table.customerName}
                </p>
              )}
              {table.reservedTime && (
                <p className="text-muted-foreground flex items-center gap-2 text-xs">
                  <Clock className="h-3.5 w-3.5" />
                  {format(new Date(table.reservedTime), "h:mm a")}
                  {table.partySize ? ` · ${table.partySize} guests` : ""}
                </p>
              )}
            </div>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {!hasOrder && (
            <>
              <p className="text-sm text-muted-foreground mb-3">
                {spotType === "table"
                  ? "This table is free. Start a new order for your guests."
                  : "Start a new order."}
              </p>
              <Button
                className="w-full h-12 gradient-primary text-white gap-2"
                onClick={() => onNewOrder(context)}
              >
                <Plus className="h-4 w-4" />
                {spotType === "table" ? "Start new order" : "Create order"}
              </Button>
            </>
          )}

          {hasOrder && (
            <>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Quick actions
              </p>

              <Button
                variant="outline"
                className="w-full h-11 justify-start gap-3"
                onClick={() => onViewOrder(order!)}
              >
                <Eye className="h-4 w-4 text-primary" />
                View order & items
                <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
              </Button>

              {isActive && (
                <Button
                  variant="outline"
                  className="w-full h-11 justify-start gap-3 border-primary/30 bg-primary/5"
                  onClick={() => onAddItems(order!)}
                >
                  <PlusCircle className="h-4 w-4 text-primary" />
                  Add more items
                </Button>
              )}

              {order!.status !== "cancelled" && (
                <Button
                  variant="outline"
                  className="w-full h-11 justify-start gap-3"
                  disabled={printingBill}
                  onClick={() => onPrintBill(order!)}
                >
                  {printingBill ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Printer className="h-4 w-4" />
                  )}
                  Print bill
                </Button>
              )}

              {showShipAction && onConfirmShip && (
                <Button
                  className="w-full h-11 justify-start gap-3 bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={shippingOrder || updatingStatus}
                  onClick={() => onConfirmShip(order!)}
                >
                  {shippingOrder ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Truck className="h-4 w-4" />
                  )}
                  Confirm &amp; ship order
                </Button>
              )}

              {isActive && next && (
                <Button
                  className="w-full h-11 justify-start gap-3 gradient-primary text-white"
                  disabled={updatingStatus}
                  onClick={() => onAdvanceStatus(order!)}
                >
                  {updatingStatus ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  {nextStatusLabel[order!.status] ?? `Mark ${next}`}
                </Button>
              )}

              {order!.status === "completed" && (
                <Button
                  className="w-full h-11 justify-start gap-3 bg-emerald-500 hover:bg-emerald-600 text-white"
                  disabled={updatingStatus}
                  onClick={() => onMarkPaid(order!)}
                >
                  {updatingStatus ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Banknote className="h-4 w-4" />
                  )}
                  Mark as paid — free table
                </Button>
              )}

              {isActive && spotType === "table" && onChangeTable && (
                <>
                  <Separator className="my-2" />
                  <Button
                    variant="outline"
                    className="w-full h-10 justify-start gap-3"
                    onClick={() => onChangeTable(order!)}
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    Change table
                  </Button>
                </>
              )}

              {isActive && (
                <Button
                  variant="ghost"
                  className="w-full h-10 justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={updatingStatus}
                  onClick={() => onCancelOrder(order!)}
                >
                  <XCircle className="h-4 w-4" />
                  Cancel order
                </Button>
              )}

              <div className="pt-2 text-xs text-muted-foreground">
                {order!.order_items.length} item
                {order!.order_items.length !== 1 ? "s" : ""} · #{order!.order_number}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Check, X, ChefHat, Receipt } from "lucide-react";
import { toast } from "sonner";
import { printKitchenOrderSlip, openKitchenPrinterSettingsIfNeeded } from "@/lib/print-kitchen";
import {
  printSelfServiceOrderSlips,
  openSelfServicePrinterSettingsIfNeeded,
} from "@/lib/print-self-service";
import { usePrinterSettings } from "@/lib/use-printer-settings";
import { useOutlet } from "@/lib/outlet-context";
import { computeReceiptTotals } from "@/lib/order-receipt-totals";

interface OrderItem {
  name: string;
  quantity: number;
  totalPrice?: number;
  gstRate?: number;
}

interface OrderData {
  outletId?: string;
  orderNumber: string;
  outletName: string;
  orderType: "dine_in" | "takeaway";
  tableNumber?: string;
  items: OrderItem[];
  subtotal: number;
  total: number;
  createdAt: Date;
}

interface OrderSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderData: OrderData | null;
  onNewOrder: () => void;
  selfService?: boolean;
  outletId?: string;
  outletName?: string;
}

export function OrderSuccessDialog({
  open,
  onOpenChange,
  orderData,
  onNewOrder,
  selfService = false,
  outletId,
  outletName,
}: OrderSuccessDialogProps) {
  const { currentOutlet } = useOutlet();
  const { settings: printerSettings } = usePrinterSettings(orderData?.outletId ?? outletId);

  const handleReprint = async () => {
    if (!orderData) return;

    if (selfService) {
      const lineItems = orderData.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        totalPrice: i.totalPrice ?? 0,
        gstRate: i.gstRate,
      }));
      const { subtotal, gstTotal, grandTotal } = computeReceiptTotals(lineItems);
      const result = await printSelfServiceOrderSlips(printerSettings, {
        outletId: orderData.outletId ?? outletId,
        outletName: orderData.outletName || outletName || "",
        gstNumber: (currentOutlet as { gst_number?: string | null })?.gst_number,
        orderNumber: orderData.orderNumber,
        orderType: orderData.orderType,
        tableNumber: orderData.tableNumber,
        items: lineItems,
        createdAt: orderData.createdAt,
        subtotal,
        gstTotal,
        grandTotal,
        source: "pos",
      });
      if (result.ok) {
        toast.success("Bill and kitchen handoff sent to printer");
      } else {
        toast.error("Print failed", { description: result.message });
        openSelfServicePrinterSettingsIfNeeded();
      }
      return;
    }

    const result = await printKitchenOrderSlip(printerSettings, {
      outletId: orderData.outletId,
      orderNumber: orderData.orderNumber,
      orderType: orderData.orderType,
      tableNumber: orderData.tableNumber,
      items: orderData.items.map((i) => ({ name: i.name, quantity: i.quantity })),
      createdAt: orderData.createdAt,
    });
    if (result.ok) {
      toast.success("Kitchen slip sent to printer");
    } else {
      toast.error("Kitchen print failed", { description: result.message });
      openKitchenPrinterSettingsIfNeeded();
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    onNewOrder();
  };

  if (!orderData) return null;

  const typeLabel = selfService
    ? "Self Service"
    : orderData.orderType === "dine_in"
      ? orderData.tableNumber
        ? `Table T${orderData.tableNumber}`
        : "Dine In"
      : "Takeaway";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="mx-auto w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mb-3">
            <Check className="h-7 w-7 text-green-500" />
          </div>
          <DialogTitle className="text-center text-xl">Order Placed!</DialogTitle>
          <DialogDescription className="text-center text-sm">
            #{orderData.orderNumber} · {typeLabel}
            {selfService
              ? " · customer bill + kitchen handoff printed"
              : " · kitchen slip printed"}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 mb-1">
            {selfService ? (
              <>
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <ChefHat className="h-4 w-4 text-muted-foreground" />
              </>
            ) : (
              <ChefHat className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {selfService ? "Customer bill + Take to kitchen" : "Kitchen Copy"}
            </span>
          </div>

          <div className="space-y-1">
            {orderData.items.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-1 border-b border-border/50 last:border-0"
              >
                <span className="text-sm font-medium">{item.name}</span>
                <span className="text-sm font-bold text-primary bg-primary/10 rounded-full px-2.5 py-0.5">
                  ×{item.quantity}
                </span>
              </div>
            ))}
          </div>
          {selfService ? (
            <p className="text-sm font-bold text-right pt-1">
              Total: ₹{orderData.total.toLocaleString("en-IN")}
            </p>
          ) : null}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 mt-1">
          <Button variant="outline" className="flex-1 gap-2" onClick={handleClose}>
            <X className="h-4 w-4" />
            Close
          </Button>
          <Button variant="secondary" className="flex-1 gap-2" onClick={handleReprint}>
            <Printer className="h-4 w-4" />
            Reprint
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

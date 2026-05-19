import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Check, X, ChefHat, Receipt, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { printKitchenOrderSlip, openKitchenPrinterSettingsIfNeeded } from "@/lib/print-kitchen";
import {
  printSelfServiceMainBill,
  printSelfServiceKitchenHandoff,
  printSelfServiceOrderSlips,
  delayForPrinterCut,
  openSelfServicePrinterSettingsIfNeeded,
  type SelfServicePrintInput,
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
  const [mainBillPrinted, setMainBillPrinted] = useState(false);
  const [kitchenPrinted, setKitchenPrinted] = useState(false);
  const [printingMain, setPrintingMain] = useState(false);
  const [printingKitchen, setPrintingKitchen] = useState(false);
  const autoStartedRef = useRef(false);

  const buildPrintInput = useCallback((): SelfServicePrintInput | null => {
    if (!orderData) return null;
    const lineItems = orderData.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      totalPrice: i.totalPrice ?? 0,
      gstRate: i.gstRate,
    }));
    const { subtotal, gstTotal, grandTotal } = computeReceiptTotals(lineItems);
    return {
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
    };
  }, [orderData, outletId, outletName, currentOutlet]);

  useEffect(() => {
    if (!open) {
      autoStartedRef.current = false;
      setMainBillPrinted(false);
      setKitchenPrinted(false);
      return;
    }
    if (!selfService || !orderData || autoStartedRef.current) return;
    if (!printerSettings.billingPrinter.selfServicePrintOnOrder) return;

    autoStartedRef.current = true;
    void (async () => {
      const input = buildPrintInput();
      if (!input) return;
      const result = await printSelfServiceOrderSlips(printerSettings, input);
      setMainBillPrinted(result.billingOk);
      setKitchenPrinted(result.kitchenHandoffOk);
      if (result.ok) {
        toast.success("Customer bill and kitchen slip printed");
      } else if (result.billingOk && !result.kitchenHandoffOk) {
        toast.warning("Bill printed — tap Print kitchen slip to retry");
      } else {
        toast.error("Print failed", { description: result.message });
        openSelfServicePrinterSettingsIfNeeded();
      }
    })();
  }, [open, selfService, orderData, printerSettings, buildPrintInput]);

  const handlePrintMainBill = async () => {
    const input = buildPrintInput();
    if (!input) return;
    setPrintingMain(true);
    try {
      const result = await printSelfServiceMainBill(printerSettings, input);
      if (result.ok) {
        setMainBillPrinted(true);
        toast.success("Customer bill sent to printer");
      } else {
        toast.error("Bill print failed", { description: result.message });
        openSelfServicePrinterSettingsIfNeeded();
      }
    } finally {
      setPrintingMain(false);
    }
  };

  const handlePrintKitchenSlip = async () => {
    if (!mainBillPrinted) {
      toast.message("Print the customer bill first");
      return;
    }
    const input = buildPrintInput();
    if (!input) return;
    setPrintingKitchen(true);
    try {
      await delayForPrinterCut();
      const result = await printSelfServiceKitchenHandoff(printerSettings, input);
      if (result.ok) {
        setKitchenPrinted(true);
        toast.success("Kitchen slip sent to printer");
      } else {
        toast.error("Kitchen slip failed", { description: result.message });
        openSelfServicePrinterSettingsIfNeeded();
      }
    } finally {
      setPrintingKitchen(false);
    }
  };

  const handleReprint = async () => {
    if (!orderData) return;

    if (selfService) {
      const input = buildPrintInput();
      if (!input) return;
      const result = await printSelfServiceOrderSlips(printerSettings, input, {
        printMainBill: true,
        printKitchenHandoff: printerSettings.billingPrinter.selfServiceBillWithHandoff,
      });
      setMainBillPrinted(result.billingOk);
      setKitchenPrinted(result.kitchenHandoffOk);
      if (result.ok) {
        toast.success("Reprinted bill and kitchen slip");
      } else {
        toast.error("Reprint failed", { description: result.message });
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
              ? mainBillPrinted && kitchenPrinted
                ? " · bill + kitchen slip printed"
                : mainBillPrinted
                  ? " · bill printed — print kitchen slip next"
                  : " · print customer bill first"
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
              {selfService ? "Two separate prints (auto-cut)" : "Kitchen Copy"}
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

        {selfService ? (
          <div className="flex flex-col gap-2">
            <Button
              className="w-full gap-2"
              variant={mainBillPrinted ? "outline" : "default"}
              disabled={printingMain}
              onClick={handlePrintMainBill}
            >
              {printingMain ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Receipt className="h-4 w-4" />
              )}
              {mainBillPrinted ? "Reprint customer bill" : "Print customer bill"}
            </Button>
            <Button
              className="w-full gap-2"
              variant={kitchenPrinted ? "outline" : "secondary"}
              disabled={!mainBillPrinted || printingKitchen}
              onClick={handlePrintKitchenSlip}
            >
              {printingKitchen ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ChefHat className="h-4 w-4" />
              )}
              {kitchenPrinted ? "Reprint kitchen slip" : "Print kitchen slip"}
            </Button>
            {!mainBillPrinted ? (
              <p className="text-xs text-center text-muted-foreground">
                Kitchen slip prints after the bill is cut on the printer.
              </p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="flex-col sm:flex-row gap-2 mt-1">
          <Button variant="outline" className="flex-1 gap-2" onClick={handleClose}>
            <X className="h-4 w-4" />
            Close
          </Button>
          {!selfService ? (
            <Button variant="secondary" className="flex-1 gap-2" onClick={handleReprint}>
              <Printer className="h-4 w-4" />
              Reprint
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Check, X, ChefHat } from "lucide-react";
import { toast } from "sonner";
import { buildKitchenSlip, printViaSerial } from "@/lib/serial-printer";
import { isNativePrinterBridgeExpected, openNativePrinterSettings, postNativeKitchenPrint } from "@/lib/native-print-bridge";

interface KitchenItem {
  name: string;
  quantity: number;
}

interface OrderData {
  outletId?: string;
  orderNumber: string;
  outletName: string;
  orderType: "dine_in" | "takeaway";
  tableNumber?: string;
  items: KitchenItem[];
  subtotal: number;
  total: number;
  createdAt: Date;
}

interface OrderSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderData: OrderData | null;
  onNewOrder: () => void;
  autoPrintKitchen?: boolean;
  kitchenFontSize?: number;
  kitchenPaperWidth?: 58 | 80;
  kitchenPortIndex?: number | null;
  kitchenBaudRate?: number;
  kitchenPrintMode?: "serial" | "browser";
  kitchenPostPrintFeedLines?: number;
  kitchenShowTearCutLine?: boolean;
  kitchenDualCopies?: boolean;
}

export function OrderSuccessDialog({
  open,
  onOpenChange,
  orderData,
  onNewOrder,
  autoPrintKitchen = false,
  kitchenFontSize = 12,
  kitchenPaperWidth = 58,
  kitchenPortIndex = null,
  kitchenBaudRate = 9600,
  kitchenPrintMode = "browser",
  kitchenPostPrintFeedLines = 4,
  kitchenShowTearCutLine = true,
  kitchenDualCopies = false,
}: OrderSuccessDialogProps) {
  // Prefer assigned serial port for kitchen jobs; use browser only when explicitly unassigned.
  const handlePrint = async () => {
    if (!orderData) return;

    const postedToNative = postNativeKitchenPrint({
      outletId: orderData.outletId,
      paperWidth: kitchenPaperWidth,
      orderNumber: orderData.orderNumber,
      orderType: orderData.orderType,
      tableNumber: orderData.tableNumber,
      items: orderData.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
      })),
      createdAt: orderData.createdAt.toISOString(),
    });
    if (postedToNative) {
      toast.success("Kitchen slip sent to native printer bridge");
      return;
    }
    if (isNativePrinterBridgeExpected()) {
      toast.error("Native printer bridge unavailable. Open Native Printer Settings and try again.");
      openNativePrinterSettings();
      return;
    }

    // If a port is assigned, always treat this as serial intent.
    const shouldUseSerial = kitchenPrintMode === "serial" || kitchenPortIndex !== null;
    if (shouldUseSerial) {
      if (kitchenPortIndex === null) {
        toast.error("Kitchen printer is set to Serial, but no port is assigned in Settings");
        return;
      }
      try {
        const bytes = buildKitchenSlip(
          {
            orderNumber: orderData.orderNumber,
            orderType: orderData.orderType,
            tableNumber: orderData.tableNumber,
            items: orderData.items,
            createdAt: orderData.createdAt,
          },
          kitchenPaperWidth,
          {
            postPrintFeedLines: kitchenPostPrintFeedLines,
            showTearCutLine: kitchenShowTearCutLine,
            dualKitchenCopies: kitchenDualCopies,
          }
        );
        await printViaSerial(kitchenPortIndex, bytes, kitchenBaudRate);
        toast.success("Kitchen slip printed");
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`Kitchen serial print failed: ${msg}`);
        return;
      }
    }

    // ── Browser mode (manual dialog) ──────────────────────────────────────
    const pt = kitchenFontSize;
    const pw = kitchenPaperWidth;
    const printWindow = window.open("", "_blank", "width=220,height=600");
    if (!printWindow) return;

    const timeStr = orderData.createdAt.toLocaleTimeString("en-IN", {
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
    const typeLabel = orderData.orderType === "dine_in"
      ? (orderData.tableNumber ? `Table T${orderData.tableNumber}` : "Dine In")
      : "TAKEAWAY";

    const itemRows = orderData.items.map((item) => `
      <tr>
        <td style="padding:3px 4px 3px 0;font-size:${pt}pt">${item.name}</td>
        <td style="text-align:right;padding:3px 0;font-size:${pt + 2}pt;font-weight:bold">x${item.quantity}</td>
      </tr>`).join("");

    printWindow.document.write(`<!DOCTYPE html>
<html><head>
  <meta charset="utf-8"/><meta name="color-scheme" content="light"/>
  <title>Kitchen #${orderData.orderNumber}</title>
  <style>
    @page { size: ${pw}mm auto; margin: 0; }
    html, body { margin:0; padding:0; width:${pw}mm; background:#fff; color:#000;
      font-family:'Courier New',Courier,monospace; font-size:${pt}pt; }
    * { color:#000 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    table { border-collapse:collapse; width:100%; }
    .dash { border-top:1px dashed #000; margin:4px 0; }
    .center { text-align:center; } .bold { font-weight:bold; }
  </style>
</head>
<body style="padding:3mm 2mm">
  <div class="center bold" style="font-size:${pt + 3}pt;margin-bottom:3mm">** KITCHEN ORDER **</div>
  <div class="dash"></div>
  <table>
    <tr><td class="bold">Order #</td><td style="text-align:right" class="bold">${orderData.orderNumber}</td></tr>
    <tr><td>Time</td><td style="text-align:right">${timeStr}</td></tr>
    <tr><td class="bold">${orderData.orderType === "dine_in" ? "Table" : "Type"}</td>
        <td style="text-align:right" class="bold">${typeLabel}</td></tr>
  </table>
  <div class="dash"></div>
  <table>
    <thead><tr class="bold" style="font-size:${pt - 1}pt"><td>ITEM</td><td style="text-align:right">QTY</td></tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div class="dash"></div>
  <div class="center" style="font-size:${pt - 1}pt;margin-top:2mm">— Kitchen Copy —</div>
  <div style="height:10mm"></div>
</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 400);
  };

  useEffect(() => {
    if (open && autoPrintKitchen && orderData) {
      const timer = setTimeout(() => handlePrint(), 600);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoPrintKitchen]);

  const handleClose = () => {
    onOpenChange(false);
    onNewOrder();
  };

  if (!orderData) return null;

  const typeLabel = orderData.orderType === "dine_in"
    ? (orderData.tableNumber ? `Table T${orderData.tableNumber}` : "Dine In")
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
            #{orderData.orderNumber} · {typeLabel} · sent to kitchen
          </DialogDescription>
        </DialogHeader>

        {/* Kitchen slip preview */}
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3 flex flex-col gap-1.5">
          {/* Header row */}
          <div className="flex items-center gap-2 mb-1">
            <ChefHat className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Kitchen Copy
            </span>
          </div>

          {/* Item list */}
          <div className="space-y-1">
            {orderData.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                <span className="text-sm font-medium">{item.name}</span>
                <span className="text-sm font-bold text-primary bg-primary/10 rounded-full px-2.5 py-0.5">
                  ×{item.quantity}
                </span>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 mt-1">
          <Button variant="outline" className="flex-1 gap-2" onClick={handleClose}>
            <X className="h-4 w-4" />
            Close
          </Button>
          <Button className="flex-1 gap-2 gradient-primary" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            Print Kitchen Slip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useRef } from "react";
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

interface KitchenItem {
  name: string;
  quantity: number;
}

interface OrderData {
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
}

export function OrderSuccessDialog({
  open,
  onOpenChange,
  orderData,
  onNewOrder,
}: OrderSuccessDialogProps) {
  const slipRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const el = slipRef.current;
    if (!el) return;
    const printWindow = window.open("", "_blank", "width=220,height=500");
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Kitchen #${orderData?.orderNumber ?? ""}</title>
  <style>
    @page { size: 58mm auto; margin: 0; }
    html, body {
      margin: 0; padding: 0; width: 58mm;
      background: #fff;
      font-family: 'Courier New', Courier, monospace;
      font-size: 10pt; color: #000;
    }
    table { border-collapse: collapse; width: 100%; }
  </style>
</head>
<body>${el.innerHTML}</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 400);
  };

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

        {/* Hidden printable kitchen slip — ref lives here so innerHTML is always accessible */}
        <div className="hidden">
          <div
            ref={slipRef}
            style={{
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: "10pt",
              lineHeight: "1.5",
              color: "#000",
              background: "#fff",
              width: "48mm",
              padding: "3mm 2mm",
              boxSizing: "border-box",
            }}
          >
            <div style={{ textAlign: "center", fontWeight: "bold", marginBottom: "2mm" }}>
              ** KITCHEN ORDER **
            </div>
            <div style={{ borderTop: "1px dashed #000", margin: "3px 0" }} />

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ fontWeight: "bold" }}>Order #</td>
                  <td style={{ textAlign: "right", fontWeight: "bold" }}>{orderData.orderNumber}</td>
                </tr>
                <tr>
                  <td>Time</td>
                  <td style={{ textAlign: "right" }}>
                    {orderData.createdAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: "bold" }}>
                    {orderData.orderType === "dine_in" ? "Table" : "Type"}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: "bold" }}>
                    {orderData.orderType === "dine_in"
                      ? (orderData.tableNumber ? `T${orderData.tableNumber}` : "—")
                      : "TAKEAWAY"}
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ borderTop: "1px dashed #000", margin: "3px 0" }} />

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ fontWeight: "bold" }}>
                  <td>ITEM</td>
                  <td style={{ textAlign: "right" }}>QTY</td>
                </tr>
              </thead>
              <tbody>
                {orderData.items.map((item, i) => (
                  <tr key={i}>
                    <td style={{ paddingTop: "2mm", paddingRight: "2mm" }}>{item.name}</td>
                    <td style={{ textAlign: "right", paddingTop: "2mm", fontWeight: "bold", fontSize: "12pt" }}>
                      x{item.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ borderTop: "1px dashed #000", margin: "3px 0" }} />
            <div style={{ textAlign: "center", fontSize: "8pt", marginTop: "1mm" }}>— Kitchen Copy —</div>
            <div style={{ height: "8mm" }} />
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

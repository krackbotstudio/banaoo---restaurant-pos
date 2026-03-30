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
import { PrintableReceipt } from "./PrintableReceipt";
import { Printer, Check, X } from "lucide-react";

interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface OrderData {
  orderNumber: string;
  outletName: string;
  orderType: "dine_in" | "takeaway";
  tableNumber?: string;
  items: ReceiptItem[];
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
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!receiptRef.current) return;

    const printContent = receiptRef.current.innerHTML;
    const printWindow = window.open("", "_blank", "width=350,height=600");
    
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Receipt - ${orderData?.orderNumber}</title>
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              body {
                font-family: 'Courier New', monospace;
                font-size: 12px;
                padding: 10px;
                max-width: 300px;
                margin: 0 auto;
              }
              .text-center { text-align: center; }
              .text-right { text-align: right; }
              .font-bold { font-weight: bold; }
              .text-lg { font-size: 16px; }
              .text-base { font-size: 14px; }
              .text-xs { font-size: 11px; }
              .uppercase { text-transform: uppercase; }
              .border-b { border-bottom: 1px dashed #999; }
              .pb-3 { padding-bottom: 12px; }
              .mb-3 { margin-bottom: 12px; }
              .mt-1 { margin-top: 4px; }
              .mb-1 { margin-bottom: 4px; }
              .mb-2 { margin-bottom: 8px; }
              .py-0\\.5 { padding-top: 2px; padding-bottom: 2px; }
              .pr-2 { padding-right: 8px; }
              .flex { display: flex; }
              .justify-between { justify-content: space-between; }
              .flex-1 { flex: 1; }
              .w-8 { width: 32px; }
              .w-16 { width: 64px; }
              .truncate { 
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              }
              .text-gray-600 { color: #666; }
              @media print {
                body { margin: 0; padding: 5px; }
              }
            </style>
          </head>
          <body>
            ${printContent}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      
      // Wait for content to load then print
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    onNewOrder();
  };

  if (!orderData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
            <Check className="h-8 w-8 text-green-500" />
          </div>
          <DialogTitle className="text-center text-xl">Order Placed!</DialogTitle>
          <DialogDescription className="text-center">
            Order #{orderData.orderNumber} has been sent to the kitchen
          </DialogDescription>
        </DialogHeader>

        {/* Receipt Preview */}
        <div className="max-h-[300px] overflow-auto bg-muted/30 rounded-lg p-4 flex justify-center">
          <div className="scale-90 origin-top">
            <PrintableReceipt ref={receiptRef} data={orderData} />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
            Close
          </Button>
          <Button
            className="flex-1 gap-2 gradient-primary glow-primary"
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4" />
            Print Receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

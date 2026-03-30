import { forwardRef } from "react";
import { format } from "date-fns";

interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface ReceiptData {
  orderNumber: string;
  outletName: string;
  orderType: "dine_in" | "takeaway";
  tableNumber?: string;
  items: ReceiptItem[];
  subtotal: number;
  total: number;
  createdAt: Date;
}

interface PrintableReceiptProps {
  data: ReceiptData;
}

export const PrintableReceipt = forwardRef<HTMLDivElement, PrintableReceiptProps>(
  ({ data }, ref) => {
    return (
      <div
        ref={ref}
        className="bg-white text-black p-4 w-[300px] font-mono text-sm print:block"
        style={{ fontFamily: "monospace" }}
      >
        {/* Header */}
        <div className="text-center border-b border-dashed border-gray-400 pb-3 mb-3">
          <h1 className="font-bold text-lg">{data.outletName}</h1>
          <p className="text-xs text-gray-600">Powered by banaoo.in</p>
        </div>

        {/* Order Info */}
        <div className="border-b border-dashed border-gray-400 pb-3 mb-3 text-xs">
          <div className="flex justify-between">
            <span>Order #:</span>
            <span className="font-bold">{data.orderNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>Date:</span>
            <span>{format(data.createdAt, "dd/MM/yyyy HH:mm")}</span>
          </div>
          <div className="flex justify-between">
            <span>Type:</span>
            <span className="uppercase">
              {data.orderType === "dine_in" ? "DINE IN" : "TAKEAWAY"}
            </span>
          </div>
          {data.orderType === "dine_in" && data.tableNumber && (
            <div className="flex justify-between">
              <span>Table:</span>
              <span className="font-bold">{data.tableNumber}</span>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="border-b border-dashed border-gray-400 pb-3 mb-3">
          <div className="flex justify-between text-xs font-bold mb-2">
            <span className="flex-1">ITEM</span>
            <span className="w-8 text-center">QTY</span>
            <span className="w-16 text-right">AMOUNT</span>
          </div>
          {data.items.map((item, index) => (
            <div key={index} className="flex justify-between text-xs py-0.5">
              <span className="flex-1 truncate pr-2">{item.name}</span>
              <span className="w-8 text-center">{item.quantity}</span>
              <span className="w-16 text-right">₹{item.totalPrice}</span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-b border-dashed border-gray-400 pb-3 mb-3 text-xs">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>₹{data.subtotal}</span>
          </div>
          <div className="flex justify-between font-bold text-base mt-1">
            <span>TOTAL:</span>
            <span>₹{data.total}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-600">
          <p className="font-bold mb-1">Thank you for your order!</p>
          <p>Visit again soon</p>
        </div>
      </div>
    );
  }
);

PrintableReceipt.displayName = "PrintableReceipt";

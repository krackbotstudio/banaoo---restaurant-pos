import { forwardRef, Fragment } from "react";
import { format } from "date-fns";

interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  gstRate?: number; // GST % for this item
}

interface ReceiptData {
  orderNumber: string;
  outletName: string;
  gstNumber?: string | null;
  orderType: "dine_in" | "takeaway";
  tableNumber?: string;
  items: ReceiptItem[];
  subtotal: number;
  discount?: number;        // flat amount
  discountPercent?: number; // % for display
  gstSlabs?: Record<number, number>; // rate% → amount
  tax?: number;             // additional cess flat amount
  taxPercent?: number;      // additional cess %
  total: number;
  createdAt: Date;
}

interface PrintableReceiptProps {
  data: ReceiptData;
}

// Thermal receipt divider
const Divider = () => (
  <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />
);

const fmt = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

export const PrintableReceipt = forwardRef<HTMLDivElement, PrintableReceiptProps>(
  ({ data }, ref) => {
    const s: React.CSSProperties = {
      fontFamily: "'Courier New', Courier, monospace",
      fontSize: "9pt",
      lineHeight: "1.35",
      color: "#000",
      background: "#fff",
      width: "48mm",
      padding: "3mm 2mm",
      boxSizing: "border-box",
    };

    // Pre-calculate per-item GST amounts (after discount ratio)
    const discountAmt = data.discount ?? 0;
    const discountRatio = data.subtotal > 0
      ? Math.max(0, data.subtotal - discountAmt) / data.subtotal
      : 1;

    return (
      <div ref={ref} style={s}>
        {/* Restaurant name */}
        <div style={{ textAlign: "center", fontWeight: "bold", fontSize: "11pt", marginBottom: "1mm" }}>
          {data.outletName}
        </div>
        {data.gstNumber && (
          <div style={{ textAlign: "center", fontSize: "8pt", marginBottom: "2mm" }}>
            GSTIN: {data.gstNumber}
          </div>
        )}

        <Divider />

        {/* Order meta */}
        <table style={{ width: "100%", fontSize: "9pt", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ paddingRight: "2mm" }}>Order #</td>
              <td style={{ textAlign: "right", fontWeight: "bold" }}>{data.orderNumber}</td>
            </tr>
            <tr>
              <td>Date</td>
              <td style={{ textAlign: "right" }}>{format(data.createdAt, "dd/MM/yy HH:mm")}</td>
            </tr>
            <tr>
              <td>Type</td>
              <td style={{ textAlign: "right", fontWeight: "bold" }}>
                {data.orderType === "dine_in" ? "DINE IN" : "TAKEAWAY"}
              </td>
            </tr>
            {data.orderType === "dine_in" && data.tableNumber && (
              <tr>
                <td>Table</td>
                <td style={{ textAlign: "right", fontWeight: "bold" }}>{data.tableNumber}</td>
              </tr>
            )}
          </tbody>
        </table>

        <Divider />

        {/* Items */}
        <table style={{ width: "100%", fontSize: "9pt", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ fontWeight: "bold" }}>
              <td style={{ width: "50%" }}>ITEM</td>
              <td style={{ width: "10%", textAlign: "center" }}>QTY</td>
              <td style={{ width: "40%", textAlign: "right" }}>AMT</td>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, i) => {
              const gstAmt = item.gstRate
                ? Math.round(item.totalPrice * discountRatio * item.gstRate / 100 * 100) / 100
                : 0;
              return (
                <Fragment key={i}>
                  <tr>
                    <td style={{ paddingTop: "1.5mm", maxWidth: "24mm", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                      {item.name}
                    </td>
                    <td style={{ textAlign: "center", paddingTop: "1.5mm" }}>{item.quantity}</td>
                    <td style={{ textAlign: "right", paddingTop: "1.5mm" }}>&#8377;{fmt(item.totalPrice)}</td>
                  </tr>
                  {item.gstRate && gstAmt > 0 && (
                    <tr>
                      <td colSpan={2} style={{ fontSize: "7.5pt", color: "#555", paddingLeft: "2mm" }}>
                        + GST @{item.gstRate}%
                      </td>
                      <td style={{ textAlign: "right", fontSize: "7.5pt", color: "#555" }}>
                        &#8377;{fmt(gstAmt)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>

        <Divider />

        {/* Totals */}
        <table style={{ width: "100%", fontSize: "9pt", borderCollapse: "collapse" }}>
          <tbody>
            {/* Subtotal */}
            <tr>
              <td>Subtotal</td>
              <td style={{ textAlign: "right" }}>&#8377;{fmt(data.subtotal)}</td>
            </tr>

            {/* Discount */}
            {!!data.discount && data.discount > 0 && (
              <tr>
                <td>Discount{data.discountPercent ? ` (${fmt(data.discountPercent)}%)` : ""}</td>
                <td style={{ textAlign: "right" }}>- &#8377;{fmt(data.discount)}</td>
              </tr>
            )}

            {/* Service Tax (manual additional tax / cess) */}
            {!!data.tax && data.tax > 0 && (
              <tr>
                <td>Service Tax{data.taxPercent ? ` (${data.taxPercent}%)` : ""}</td>
                <td style={{ textAlign: "right" }}>+ &#8377;{fmt(data.tax)}</td>
              </tr>
            )}

            {/* Grand total */}
            <tr>
              <td colSpan={2}>
                <div style={{ borderTop: "1px solid #000", margin: "2px 0" }} />
              </td>
            </tr>
            <tr style={{ fontWeight: "bold", fontSize: "11pt" }}>
              <td>TOTAL</td>
              <td style={{ textAlign: "right" }}>&#8377;{fmt(data.total)}</td>
            </tr>
          </tbody>
        </table>

        <Divider />

        {/* Footer */}
        <div style={{ textAlign: "center", fontSize: "8pt", marginTop: "2mm", lineHeight: "1.5" }}>
          <div style={{ fontWeight: "bold" }}>Thank you!</div>
          <div>Visit us again soon</div>
          <div style={{ marginTop: "2mm", color: "#888" }}>Powered by banaoo.in</div>
        </div>

        {/* Feed space so thermal cutter doesn't clip last line */}
        <div style={{ height: "8mm" }} />
      </div>
    );
  }
);

PrintableReceipt.displayName = "PrintableReceipt";

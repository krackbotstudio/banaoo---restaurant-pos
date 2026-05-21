import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/context/cart-context";
import { useCustomer } from "@/context/customer-context";
import { CustomerTablePicker } from "@/components/customer/CustomerTablePicker";
import { ArrowLeft, Loader2, UtensilsCrossed, ShoppingBag, Banknote, MapPin, Edit2, Truck, Smartphone } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL ?? "";

interface Outlet {
  id: string;
  name: string;
}

interface PaymentSettings {
  online_payments_enabled: boolean;
  upi_vpa: string | null;
}

export default function CheckoutPage({ outlet, basePath }: { outlet: Outlet; basePath?: string }) {
  const resolvedBase = basePath ?? `/r/${outlet.id}`;
  const navigate = useNavigate();
  const { items, total, itemCount, clearCart } = useCart();
  const { customer, saveCustomer } = useCustomer();

  const defaultAddr = customer?.customer_addresses?.find((a) => a.is_default);

  const [name, setName] = useState(customer?.name ?? "");
  const [phone] = useState(customer?.phone ?? "");
  const [orderType, setOrderType] = useState<"dine_in" | "takeaway" | "delivery">("dine_in");
  const [tableId, setTableId] = useState<string | undefined>();
  const [tableNumber, setTableNumber] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState(defaultAddr?.address_text ?? "");
  const [editingAddress, setEditingAddress] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "upi">("cod");
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (customer?.name && !name) setName(customer.name);
    if (defaultAddr?.address_text && !deliveryAddress) setDeliveryAddress(defaultAddr.address_text);
  }, [customer]);

  useEffect(() => {
    fetch(`${API_URL}/api/public/outlets/${outlet.id}/payment-settings`)
      .then((r) => r.json())
      .then((s: PaymentSettings) => {
        setPaymentSettings(s);
        if (!s.upi_vpa || !s.online_payments_enabled) setPaymentMethod("cod");
      })
      .catch(() => setPaymentSettings({ online_payments_enabled: false, upi_vpa: null }));
  }, [outlet.id]);

  if (itemCount === 0) {
    navigate(resolvedBase);
    return null;
  }

  const upiAvailable =
    paymentSettings?.online_payments_enabled && !!paymentSettings?.upi_vpa;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) { setError("Please enter your name"); return; }
    if (orderType === "dine_in" && !tableId) { setError("Please select your table"); return; }
    if (orderType === "delivery" && !deliveryAddress.trim()) { setError("Please enter a delivery address"); return; }
    if (paymentMethod === "upi" && !upiAvailable) {
      setError("UPI payment is not available. Choose pay at counter.");
      return;
    }

    setLoading(true);
    try {
      if (customer && name.trim() !== customer.name) {
        await saveCustomer(customer.phone, name.trim());
      }

      const res = await fetch(`${API_URL}/api/public/customer-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outlet_id: outlet.id,
          order_type: orderType,
          table_id: orderType === "dine_in" ? tableId : null,
          table_number: orderType === "dine_in" ? tableNumber : null,
          delivery_address: orderType === "delivery" ? deliveryAddress.trim() : null,
          customer_name: name.trim(),
          customer_phone: phone || null,
          notes: notes.trim() || null,
          payment_method: paymentMethod,
          items: items.map((item) => ({
            menu_item_id: item.menu_item_id,
            item_name: item.name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            notes: item.notes || null,
          })),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create order");

      clearCart();

      if (json.requires_upi) {
        navigate(`${resolvedBase}/payment/${json.order_id}`, { replace: true });
        return;
      }

      navigate(`${resolvedBase}/confirmed`, {
        state: {
          order_number: json.order_number,
          order_id: json.order_id,
          total: json.total,
          payment_method: "cod",
        },
        replace: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex items-center gap-2 px-4 py-3 bg-white border-b border-gray-100">
        <button type="button" onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-700" />
        </button>
        <h2 className="font-bold text-base text-gray-900">Checkout</h2>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 px-4 py-4 space-y-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-3">
          <h3 className="font-semibold text-sm text-gray-900">Your Details</h3>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Name *</label>
            <input
              type="text"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Phone</label>
            <input
              type="tel"
              value={phone}
              readOnly
              className="w-full border border-gray-100 bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-gray-500 cursor-not-allowed"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-3">
          <h3 className="font-semibold text-sm text-gray-900">Order Type</h3>
          <div className="grid grid-cols-3 gap-2">
            {(["dine_in", "takeaway", "delivery"] as const).map((type) => {
              const icons = { dine_in: UtensilsCrossed, takeaway: ShoppingBag, delivery: Truck };
              const labels = { dine_in: "Dine In", takeaway: "Takeaway", delivery: "Delivery" };
              const Icon = icons[type];
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setOrderType(type)}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 text-xs font-semibold transition-colors ${
                    orderType === type
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-gray-200 text-gray-600"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {labels[type]}
                </button>
              );
            })}
          </div>

          {orderType === "dine_in" && (
            <CustomerTablePicker
              outletId={outlet.id}
              selectedTableId={tableId}
              onSelectTable={(id, num) => {
                setTableId(id);
                setTableNumber(num);
              }}
            />
          )}

          {orderType === "delivery" && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">Delivery Address *</label>
                <button
                  type="button"
                  onClick={() => setEditingAddress(!editingAddress)}
                  className="flex items-center gap-1 text-xs text-primary font-medium"
                >
                  <Edit2 className="h-3 w-3" />
                  {editingAddress ? "Done" : "Edit"}
                </button>
              </div>
              {editingAddress ? (
                <textarea
                  rows={2}
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Enter delivery address"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setEditingAddress(true)}
                  onKeyDown={(e) => e.key === "Enter" && setEditingAddress(true)}
                  className={`flex items-start gap-2 border rounded-lg px-3 py-2.5 cursor-pointer ${
                    deliveryAddress ? "border-gray-200 bg-gray-50" : "border-dashed border-gray-300"
                  }`}
                >
                  <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span className={`text-sm ${deliveryAddress ? "text-gray-700" : "text-gray-400"}`}>
                    {deliveryAddress || "Tap to enter delivery address"}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-3">
          <h3 className="font-semibold text-sm text-gray-900">Payment</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod("cod")}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors ${
                paymentMethod === "cod"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-gray-200 text-gray-600"
              }`}
            >
              <Banknote className="h-4 w-4" /> Pay at counter
            </button>
            <button
              type="button"
              onClick={() => upiAvailable && setPaymentMethod("upi")}
              disabled={!upiAvailable}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors ${
                paymentMethod === "upi"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-gray-200 text-gray-600"
              } ${!upiAvailable ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              <Smartphone className="h-4 w-4" /> UPI now
            </button>
          </div>
          {!upiAvailable && (
            <p className="text-xs text-gray-500">UPI not set up for this restaurant — pay at counter only.</p>
          )}
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <label className="text-xs text-gray-500 mb-1 block">Special Instructions (optional)</label>
          <textarea
            rows={2}
            placeholder="e.g. Less spicy, no onions..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-2">
          <h3 className="font-semibold text-sm text-gray-900 mb-2">Order Summary</h3>
          {items.map((item) => (
            <div key={item.menu_item_id} className="flex justify-between text-sm text-gray-600">
              <span>{item.name} × {item.quantity}</span>
              <span>₹{(item.unit_price * item.quantity).toFixed(0)}</span>
            </div>
          ))}
          <div className="border-t border-gray-100 pt-2 flex justify-between font-bold text-sm text-gray-900">
            <span>Total</span>
            <span>₹{total.toFixed(0)}</span>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}
      </form>

      <div className="sticky bottom-16 px-4 pb-3 bg-gray-50 pt-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-primary text-white font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Placing Order...</>
          ) : (
            <>
              {paymentMethod === "upi" ? "Continue to UPI" : "Place Order"} · ₹{total.toFixed(0)}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

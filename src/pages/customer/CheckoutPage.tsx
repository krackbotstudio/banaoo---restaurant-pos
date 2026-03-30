import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/context/cart-context";
import { useCustomer } from "@/context/customer-context";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2, UtensilsCrossed, ShoppingBag, CreditCard, Banknote, MapPin, Edit2, Truck } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface Outlet {
  id: string;
  name: string;
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
  const [tableNumber, setTableNumber] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState(defaultAddr?.address_text ?? "");
  const [editingAddress, setEditingAddress] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "online">("cod");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Sync if customer changes
  useEffect(() => {
    if (customer?.name && !name) setName(customer.name);
    if (defaultAddr?.address_text && !deliveryAddress) setDeliveryAddress(defaultAddr.address_text);
  }, [customer]);

  if (itemCount === 0) {
    navigate(resolvedBase);
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) { setError("Please enter your name"); return; }
    if (orderType === "dine_in" && !tableNumber.trim()) { setError("Please enter your table number"); return; }
    if (orderType === "delivery" && !deliveryAddress.trim()) { setError("Please enter a delivery address"); return; }

    setLoading(true);
    try {
      // If name changed, update customer profile
      if (customer && name.trim() !== customer.name) {
        await saveCustomer(customer.phone, name.trim());
      }

      // Generate order number and calculate total
      const orderNumber = `ONL-${Date.now().toString(36).toUpperCase()}`;
      const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

      // Insert order directly (created_by is nullable for customer orders)
      const { data: order, error: orderError } = await db
        .from("orders")
        .insert({
          outlet_id: outlet.id,
          order_number: orderNumber,
          order_type: orderType,
          table_number: orderType === "dine_in" ? tableNumber.trim() : null,
          delivery_address: orderType === "delivery" ? deliveryAddress.trim() : null,
          subtotal,
          total: subtotal,
          notes: notes.trim() || null,
          status: "pending",
          source: "online",
          customer_name: name.trim(),
          customer_phone: phone || null,
        })
        .select("id, order_number")
        .single();

      if (orderError || !order) {
        console.error("Order insert error:", orderError);
        throw new Error("Failed to create order");
      }

      // Insert order items
      const orderItems = items.map((item) => ({
        order_id: order.id,
        menu_item_id: item.menu_item_id,
        item_name: item.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.unit_price * item.quantity,
        notes: item.notes || null,
      }));

      const { error: itemsError } = await db.from("order_items").insert(orderItems);

      if (itemsError) {
        console.error("Order items error:", itemsError);
        await db.from("orders").delete().eq("id", order.id);
        throw new Error("Failed to save order items");
      }

      clearCart();
      navigate(`${resolvedBase}/confirmed`, {
        state: {
          order_number: order.order_number,
          order_id: order.id,
          total: subtotal,
          payment_method: paymentMethod,
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
      {/* Back header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-white border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-700" />
        </button>
        <h2 className="font-bold text-base text-gray-900">Checkout</h2>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 px-4 py-4 space-y-4">
        {/* Customer Details */}
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

        {/* Order Type */}
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
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Table Number *</label>
              <input
                type="text"
                placeholder="e.g. T5 or 12"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
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
                  onClick={() => setEditingAddress(true)}
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

        {/* Payment Method */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-3">
          <h3 className="font-semibold text-sm text-gray-900">Payment Method</h3>
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
              <Banknote className="h-4 w-4" /> Cash
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod("online")}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors ${
                paymentMethod === "online"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-gray-200 text-gray-600"
              }`}
            >
              <CreditCard className="h-4 w-4" /> Online
            </button>
          </div>
        </div>

        {/* Notes */}
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

        {/* Order Summary */}
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

      {/* Place Order Button */}
      <div className="sticky bottom-16 px-4 pb-3 bg-gray-50 pt-2">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-primary text-white font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Placing Order...</>
          ) : (
            <>Place Order · ₹{total.toFixed(0)}</>
          )}
        </button>
      </div>
    </div>
  );
}

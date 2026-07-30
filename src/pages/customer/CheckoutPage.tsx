import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/context/cart-context";
import { useCustomer } from "@/context/customer-context";
import { CustomerTablePicker } from "@/components/customer/CustomerTablePicker";
import {
  DeliveryLocationPicker,
  DeliveryLocationValue,
} from "@/components/customer/DeliveryLocationPicker";
import { reverseGeocode } from "@/lib/geocoding";
import {
  getCustomerOrderTypes,
  getDefaultCustomerOrderType,
  type CustomerOrderType,
} from "@/lib/business-types";
import { supabase } from "@/integrations/supabase/client";
import { API_URL } from "@/lib/api-url";
import { ArrowLeft, Loader2, UtensilsCrossed, ShoppingBag, Banknote, Truck, Smartphone } from "lucide-react";

interface Outlet {
  id: string;
  name: string;
  business_type?: string | null;
  operation_mode?: string | null;
}

interface PaymentSettings {
  online_payments_enabled: boolean;
  online_checkout_enabled?: boolean;
  razorpay_connected?: boolean;
  online_payment_provider?: string | null;
  allow_cod?: boolean;
}

export default function CheckoutPage({ outlet, basePath }: { outlet: Outlet; basePath?: string }) {
  const resolvedBase = basePath ?? `/r/${outlet.id}`;
  const navigate = useNavigate();
  const { items, total, itemCount, clearCart, removeItem } = useCart();
  const { customer, saveCustomer } = useCustomer();

  const defaultAddr = customer?.customer_addresses?.find((a) => a.is_default);

  const allowedOrderTypes = useMemo(
    () => getCustomerOrderTypes(outlet.business_type),
    [outlet.business_type]
  );
  const defaultOrderType = useMemo(
    () => getDefaultCustomerOrderType(outlet.business_type),
    [outlet.business_type]
  );

  const [name, setName] = useState(customer?.name ?? "");
  const [phone] = useState(customer?.phone ?? "");
  const [orderType, setOrderType] = useState<CustomerOrderType>(defaultOrderType);
  const [tableId, setTableId] = useState<string | undefined>();
  const [tableNumber, setTableNumber] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState<DeliveryLocationValue>({
    addressText: defaultAddr?.address_text ?? "",
    pincode: "",
    city: "",
    state: "",
    lat: defaultAddr?.lat ?? null,
    lng: defaultAddr?.lng ?? null,
  });
  const [locationError, setLocationError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "online">("cod");
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const geocodedAddrId = useRef<string | null>(null);

  const patchDeliveryLocation = (patch: Partial<DeliveryLocationValue>) => {
    setDeliveryLocation((prev) => ({ ...prev, ...patch }));
  };

  useEffect(() => {
    if (customer?.name && !name) setName(customer.name);
  }, [customer, name]);

  useEffect(() => {
    if (!allowedOrderTypes.includes(orderType)) {
      setOrderType(defaultOrderType);
      setTableId(undefined);
      setTableNumber("");
    }
  }, [allowedOrderTypes, defaultOrderType, orderType]);

  useEffect(() => {
    if (!defaultAddr) return;
    const addrKey = defaultAddr.id ?? defaultAddr.address_text;
    if (geocodedAddrId.current === addrKey) return;

    setDeliveryLocation((prev) => ({
      ...prev,
      addressText: prev.addressText || defaultAddr.address_text || "",
      lat: prev.lat ?? defaultAddr.lat ?? null,
      lng: prev.lng ?? defaultAddr.lng ?? null,
    }));

    if (defaultAddr.lat != null && defaultAddr.lng != null) {
      geocodedAddrId.current = addrKey;
      reverseGeocode(defaultAddr.lat, defaultAddr.lng).then((result) => {
        setDeliveryLocation((prev) => ({
          ...prev,
          addressText: prev.addressText || defaultAddr.address_text || result.addressText,
          pincode: prev.pincode || result.pincode,
          city: prev.city || result.city,
          state: prev.state || result.state,
          lat: prev.lat ?? defaultAddr.lat ?? null,
          lng: prev.lng ?? defaultAddr.lng ?? null,
        }));
      });
    }
  }, [defaultAddr]);

  useEffect(() => {
    fetch(`${API_URL}/api/public/outlets/${outlet.id}/payment-settings`)
      .then((r) => r.json())
      .then((s: PaymentSettings) => {
        setPaymentSettings(s);
        if (!s.online_checkout_enabled) setPaymentMethod("cod");
      })
      .catch(() => setPaymentSettings({ online_payments_enabled: false }));
  }, [outlet.id]);

  useEffect(() => {
    if (itemCount === 0) {
      navigate(resolvedBase, { replace: true });
    }
  }, [itemCount, navigate, resolvedBase]);

  useEffect(() => {
    if (!outlet.id || items.length === 0) return;
    const ids = items.map((i) => i.menu_item_id);
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("menu_items")
        .select("id")
        .eq("outlet_id", outlet.id)
        .eq("is_available", true)
        .in("id", ids);
      if (cancelled) return;
      const valid = new Set((data ?? []).map((r) => r.id));
      ids.forEach((id) => {
        if (!valid.has(id)) removeItem(id);
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [outlet.id, items.map((i) => i.menu_item_id).join(","), removeItem]);

  if (itemCount === 0) {
    return null;
  }

  const onlineAvailable = Boolean(paymentSettings?.online_checkout_enabled);
  const codAvailable = paymentSettings?.allow_cod !== false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) { setError("Please enter your name"); return; }
    if (orderType === "dine_in" && !tableId) { setError("Please select your table"); return; }
    if (orderType === "delivery") {
      if (!deliveryLocation.addressText.trim()) {
        setError("Please enter a delivery address");
        return;
      }
      if (
        !deliveryLocation.pincode.trim() ||
        !deliveryLocation.city.trim() ||
        !deliveryLocation.state.trim()
      ) {
        setError("Please enter pincode, city, and state for delivery");
        return;
      }
      if (deliveryLocation.lat == null || deliveryLocation.lng == null) {
        setError("Please set your delivery location on the map");
        return;
      }
    }
    if (paymentMethod === "online" && !onlineAvailable) {
      setError("Online payment is not available for this outlet right now.");
      return;
    }
    if (paymentMethod === "cod" && !codAvailable) {
      setError("Cash on delivery is disabled for this outlet.");
      return;
    }

    setLoading(true);
    try {
      if (customer) {
        if (orderType === "delivery") {
          await saveCustomer(customer.phone, name.trim(), {
            id: defaultAddr?.id,
            label: defaultAddr?.label ?? "Home",
            address_text: deliveryLocation.addressText.trim(),
            lat: deliveryLocation.lat,
            lng: deliveryLocation.lng,
            is_default: true,
          });
        } else if (name.trim() !== customer.name) {
          await saveCustomer(customer.phone, name.trim());
        }
      }

      const res = await fetch(`${API_URL}/api/public/customer-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outlet_id: outlet.id,
          order_type: orderType,
          table_id: orderType === "dine_in" ? tableId : null,
          table_number: orderType === "dine_in" ? tableNumber : null,
          delivery_address: orderType === "delivery" ? deliveryLocation.addressText.trim() : null,
          delivery_pincode: orderType === "delivery" ? deliveryLocation.pincode.trim() : null,
          delivery_city: orderType === "delivery" ? deliveryLocation.city.trim() : null,
          delivery_state: orderType === "delivery" ? deliveryLocation.state.trim() : null,
          delivery_latitude: orderType === "delivery" ? deliveryLocation.lat : null,
          delivery_longitude: orderType === "delivery" ? deliveryLocation.lng : null,
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

      if (json.requires_online_payment) {
        navigate(`${resolvedBase}/payment/${json.order_id}`, { replace: true });
        return;
      }

      navigate(`${resolvedBase}/confirmed`, {
        state: {
          order_number: json.order_number,
          order_id: json.order_id,
          total: json.total,
          payment_method: "cod",
          order_type: orderType,
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
          <div
            className={`grid gap-2 ${
              allowedOrderTypes.length === 1
                ? "grid-cols-1"
                : allowedOrderTypes.length === 2
                  ? "grid-cols-2"
                  : "grid-cols-3"
            }`}
          >
            {allowedOrderTypes.map((type) => {
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
              <label className="text-xs text-gray-500 mb-2 block">Delivery Location *</label>
              <DeliveryLocationPicker
                value={deliveryLocation}
                onChange={patchDeliveryLocation}
                locationError={locationError}
                onLocationError={setLocationError}
              />
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-3">
          <h3 className="font-semibold text-sm text-gray-900">Payment</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod("cod")}
              disabled={!codAvailable}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors ${
                paymentMethod === "cod"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-gray-200 text-gray-600"
              } ${!codAvailable ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              <Banknote className="h-4 w-4" /> Pay at counter
            </button>
            <button
              type="button"
              onClick={() => onlineAvailable && setPaymentMethod("online")}
              disabled={!onlineAvailable}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors ${
                paymentMethod === "online"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-gray-200 text-gray-600"
              } ${!onlineAvailable ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              <Smartphone className="h-4 w-4" />{" "}
              {paymentSettings?.online_payment_provider === "google_pay"
                ? "Google Pay / UPI"
                : "Online payment"}
            </button>
          </div>
          {!onlineAvailable && (
            <p className="text-xs text-gray-500">Online payment is currently unavailable for this outlet.</p>
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
          className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Placing Order...</>
          ) : (
            <>
              {paymentMethod === "online" ? "Continue to payment" : "Place Order"} · ₹{total.toFixed(0)}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

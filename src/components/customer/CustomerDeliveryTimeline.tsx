import { useCallback, useEffect, useState } from "react";
import { API_URL } from "@/lib/api-url";
import { Loader2, Phone, CheckCircle2, Bike } from "lucide-react";
import { ShiprocketLogo } from "@/components/shiprocket/ShiprocketLogo";
import { DeliveryTrackingMap, TrackActivity } from "@/components/customer/DeliveryTrackingMap";

interface DeliveryStatus {
  order_status: string;
  delivery_status: string;
  label: string;
  awb_code: string | null;
  courier_name: string | null;
  tracking_url: string | null;
  estimated_delivery_at: string | null;
  delivered_at: string | null;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  outlet_name: string | null;
  outlet_latitude: number | null;
  outlet_longitude: number | null;
  rider_name: string | null;
  rider_phone: string | null;
  rider_vehicle: string | null;
  rider_latitude: number | null;
  rider_longitude: number | null;
  track_activities: TrackActivity[];
  timeline: { event_code: string; event_message: string; occurred_at: string }[];
}

const STEPS = [
  { key: "accepted", label: "Order Accepted" },
  { key: "preparing", label: "Preparing" },
  { key: "booked", label: "Shipment Booked" },
  { key: "awaiting_rider", label: "Awaiting Rider" },
  { key: "rider_assigned", label: "Rider Assigned" },
  { key: "picked_up", label: "Picked Up" },
  { key: "out_for_delivery", label: "Out For Delivery" },
  { key: "delivered", label: "Delivered" },
];

function stepIndex(status: string, orderStatus: string): number {
  if (status === "delivered") return 7;
  if (status === "out_for_delivery") return 6;
  if (status === "picked_up") return 5;
  if (status === "rider_assigned") return 4;
  if (status === "awaiting_rider") return 3;
  if (status === "shipment_created") return 2;
  if (status === "booking" || orderStatus === "preparing") return 1;
  return 0;
}

function pollIntervalMs(status: string): number {
  if (["out_for_delivery", "picked_up", "rider_assigned"].includes(status)) return 10_000;
  return 30_000;
}

export function CustomerDeliveryTimeline({
  orderId,
  customerPhone,
}: {
  orderId: string;
  customerPhone?: string | null;
}) {
  const [data, setData] = useState<DeliveryStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const q = customerPhone ? `?phone=${encodeURIComponent(customerPhone)}` : "";
      const res = await fetch(`${API_URL}/api/public/orders/${orderId}/delivery-status${q}`);
      if (!res.ok) {
        setData(null);
        return;
      }
      setData(await res.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [orderId, customerPhone]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!data || data.delivery_status === "delivered" || data.delivery_status === "cancelled") {
      return;
    }
    const interval = setInterval(() => void fetchStatus(), pollIntervalMs(data.delivery_status));
    return () => clearInterval(interval);
  }, [data?.delivery_status, fetchStatus]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading delivery status…
      </div>
    );
  }

  if (!data) return null;

  const active = stepIndex(data.delivery_status, data.order_status);
  const isDelivered = data.delivery_status === "delivered";
  const isTerminal = isDelivered || data.delivery_status === "cancelled";

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4 shadow-sm">
      <div className="flex items-center gap-2">
        <ShiprocketLogo variant="icon" className="h-5 w-5" />
        <span className="text-sm font-semibold text-gray-900">Live Delivery Tracking</span>
        {!isTerminal && (
          <span className="text-[10px] text-emerald-600 font-medium ml-auto flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            Live (10s refresh)
          </span>
        )}
      </div>

      {isDelivered ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="text-xs font-bold text-emerald-900">Order Delivered!</p>
            <p className="text-[11px] text-emerald-700">
              Your food was delivered successfully by {data.rider_name || data.courier_name || "the delivery partner"}.
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm font-semibold text-primary flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          {data.label}
        </p>
      )}

      <DeliveryTrackingMap
        deliveryLat={data.delivery_latitude}
        deliveryLng={data.delivery_longitude}
        outletLat={data.outlet_latitude}
        outletLng={data.outlet_longitude}
        outletName={data.outlet_name}
        deliveryStatus={data.delivery_status}
        trackActivities={data.track_activities}
        trackingUrl={data.tracking_url}
        riderName={data.rider_name || data.courier_name}
        riderLat={data.rider_latitude}
        riderLng={data.rider_longitude}
      />

      <div className="flex justify-between gap-1 pt-1">
        {STEPS.map((step, i) => (
          <div key={step.key} className="flex-1 text-center">
            <div
              className={`mx-auto h-2 w-2 rounded-full mb-1 transition-colors ${
                i <= active ? "bg-primary" : "bg-gray-200"
              }`}
            />
            <span className={`text-[10px] leading-tight block ${i <= active ? "text-gray-800 font-medium" : "text-gray-400"}`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {(data.rider_name || data.rider_phone) && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
              <Bike className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900">{data.rider_name || "Assigned Rider"}</p>
              <p className="text-[11px] text-gray-500">
                {data.rider_vehicle ? `Vehicle: ${data.rider_vehicle} · ` : ""}
                {data.courier_name || "Shiprocket Quick"}
              </p>
            </div>
          </div>

          {data.rider_phone && (
            <a
              href={`tel:${data.rider_phone}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-xs"
            >
              <Phone className="h-3.5 w-3.5" />
              Call Rider
            </a>
          )}
        </div>
      )}

      {data.awb_code && (
        <p className="text-[11px] text-gray-400">AWB Tracking Code: {data.awb_code}</p>
      )}
    </div>
  );
}

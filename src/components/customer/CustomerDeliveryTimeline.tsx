import { useCallback, useEffect, useState } from "react";
import { API_URL } from "@/lib/api-url";
import { Loader2 } from "lucide-react";
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
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  outlet_name: string | null;
  outlet_latitude: number | null;
  outlet_longitude: number | null;
  rider_name: string | null;
  rider_phone: string | null;
  track_activities: TrackActivity[];
  timeline: { event_code: string; event_message: string; occurred_at: string }[];
}

const STEPS = [
  { key: "accepted", label: "Accepted" },
  { key: "preparing", label: "Preparing" },
  { key: "rider", label: "Rider assigned" },
  { key: "picked_up", label: "Picked up" },
  { key: "delivered", label: "Delivered" },
];

function stepIndex(status: string, orderStatus: string): number {
  if (status === "delivered") return 4;
  if (status === "out_for_delivery" || status === "picked_up") return 3;
  if (["rider_assigned", "awaiting_rider", "shipment_created"].includes(status)) return 2;
  if (status === "booking" || orderStatus === "preparing") return 1;
  return 0;
}

function pollIntervalMs(status: string): number {
  if (["out_for_delivery", "picked_up", "rider_assigned"].includes(status)) return 20_000;
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
  const isTerminal = data.delivery_status === "delivered" || data.delivery_status === "cancelled";

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <ShiprocketLogo variant="icon" className="h-5 w-5" />
        <span className="text-sm font-semibold text-gray-900">Delivery tracking</span>
        {!isTerminal && (
          <span className="text-[10px] text-gray-400 ml-auto">Updates every 20–30s</span>
        )}
      </div>

      <p className="text-sm font-medium text-primary">{data.label}</p>

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
      />

      <div className="flex justify-between gap-1">
        {STEPS.map((step, i) => (
          <div key={step.key} className="flex-1 text-center">
            <div
              className={`mx-auto h-2 w-2 rounded-full mb-1 ${
                i <= active ? "bg-primary" : "bg-gray-200"
              }`}
            />
            <span className={`text-[10px] leading-tight block ${i <= active ? "text-gray-800" : "text-gray-400"}`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {data.rider_phone && (
        <p className="text-xs text-gray-500">
          Rider phone:{" "}
          <a href={`tel:${data.rider_phone}`} className="text-primary font-medium">
            {data.rider_phone}
          </a>
        </p>
      )}

      {data.awb_code && (
        <p className="text-xs text-gray-400">AWB: {data.awb_code}</p>
      )}
    </div>
  );
}

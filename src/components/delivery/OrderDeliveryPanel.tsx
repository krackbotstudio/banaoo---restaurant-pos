import { useCallback, useEffect, useState } from "react";
import { API_URL } from "@/lib/api-url";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, Loader2, RefreshCw, XCircle } from "lucide-react";
import { ShiprocketLogo } from "@/components/shiprocket/ShiprocketLogo";

interface TrackingEvent {
  event_code: string;
  event_message: string;
  occurred_at: string;
}

interface Shipment {
  id: string;
  status: string;
  shiprocket_order_id: string | null;
  shipment_id: string | null;
  awb_code: string | null;
  courier_name: string | null;
  tracking_url: string | null;
  estimated_pickup_at: string | null;
  estimated_delivery_at: string | null;
  booked_at: string | null;
  last_error: string | null;
  retry_count: number;
}

const STATUS_LABELS: Record<string, string> = {
  not_booked: "Not booked",
  booking: "Booking scheduled",
  shipment_created: "Shipment created",
  awaiting_rider: "Awaiting rider",
  rider_assigned: "Rider assigned",
  picked_up: "Picked up",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  booking_failed: "Booking failed",
};

export function OrderDeliveryPanel({ orderId }: { orderId: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [events, setEvents] = useState<TrackingEvent[]>([]);

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/orders/${orderId}/shiprocket`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load delivery info");
      setShipment(json.shipment ?? null);
      setEvents(json.events ?? []);
    } catch {
      setShipment(null);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void fetchDetails();
    const interval = setInterval(() => void fetchDetails(), 30000);
    return () => clearInterval(interval);
  }, [fetchDetails]);

  const handleRetry = async () => {
    setActing(true);
    try {
      const res = await fetch(`${API_URL}/api/orders/${orderId}/shiprocket/retry`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Retry failed");
      toast({ title: "Retry queued", description: "Shipment booking will be retried." });
      await fetchDetails();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Retry failed",
        description: err instanceof Error ? err.message : "Could not retry",
      });
    } finally {
      setActing(false);
    }
  };

  const handleCancel = async () => {
    setActing(true);
    try {
      const res = await fetch(`${API_URL}/api/orders/${orderId}/shiprocket/cancel`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Cancel failed");
      toast({ title: "Cancelled", description: "Shipment cancelled on Shiprocket." });
      await fetchDetails();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Cancel failed",
        description: err instanceof Error ? err.message : "Could not cancel",
      });
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading delivery…
        </CardContent>
      </Card>
    );
  }

  if (!shipment) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShiprocketLogo variant="icon" className="h-5 w-5" />
            Delivery
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No Shiprocket shipment yet. Enable auto-delivery in Settings → Delivery.
        </CardContent>
      </Card>
    );
  }

  const canRetry = ["booking_failed", "not_booked"].includes(shipment.status);
  const canCancel = !["delivered", "cancelled"].includes(shipment.status) && shipment.shipment_id;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShiprocketLogo variant="icon" className="h-5 w-5" />
            Shiprocket Delivery
          </CardTitle>
          <Badge variant="outline">{STATUS_LABELS[shipment.status] ?? shipment.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {shipment.awb_code && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">AWB</span>
            <span className="font-mono">{shipment.awb_code}</span>
          </div>
        )}
        {shipment.courier_name && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Courier</span>
            <span>{shipment.courier_name}</span>
          </div>
        )}
        {shipment.estimated_delivery_at && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">ETA</span>
            <span>{new Date(shipment.estimated_delivery_at).toLocaleString("en-IN")}</span>
          </div>
        )}
        {shipment.last_error && (
          <p className="text-destructive text-xs">{shipment.last_error}</p>
        )}

        {events.length > 0 && (
          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Timeline</p>
            {events.map((ev, i) => (
              <div key={i} className="flex gap-2 text-xs">
                <span className="text-muted-foreground shrink-0">
                  {ev.occurred_at ? new Date(ev.occurred_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                </span>
                <span>{ev.event_message || ev.event_code}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          {shipment.tracking_url && (
            <Button size="sm" variant="outline" asChild>
              <a href={shipment.tracking_url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                Track
              </a>
            </Button>
          )}
          {canRetry && (
            <Button size="sm" variant="outline" onClick={handleRetry} disabled={acting}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Retry booking
            </Button>
          )}
          {canCancel && (
            <Button size="sm" variant="outline" onClick={handleCancel} disabled={acting}>
              <XCircle className="h-3.5 w-3.5 mr-1" />
              Cancel shipment
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

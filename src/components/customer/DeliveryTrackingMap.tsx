import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@/lib/leaflet-setup";
import { forwardGeocode } from "@/lib/geocoding";
import { Loader2, ExternalLink } from "lucide-react";

export interface TrackActivity {
  activity: string;
  location: string;
  date: string;
}

interface DeliveryTrackingMapProps {
  deliveryLat: number | null;
  deliveryLng: number | null;
  outletLat?: number | null;
  outletLng?: number | null;
  outletName?: string | null;
  deliveryStatus: string;
  trackActivities?: TrackActivity[];
  trackingUrl?: string | null;
  riderName?: string | null;
  riderLat?: number | null;
  riderLng?: number | null;
}

function pinIcon(color: string, label: string) {
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%)">
      <div style="background:${color};color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:8px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.3)">${label}</div>
      <div style="width:12px;height:12px;background:${color};border:2px solid #fff;border-radius:50%;margin-top:2px;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

const restaurantIcon = pinIcon("#16a34a", "Restaurant");
const deliveryIcon = pinIcon("#7c3aed", "You");
const riderIcon = pinIcon("#2563eb", "🏍 Rider");
const scanIcon = pinIcon("#ea580c", "Last update");
const deliveredIcon = pinIcon("#16a34a", "✓ Delivered");

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 15 });
  }, [points, map]);
  return null;
}

function MapSizeInvalidator() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629];

export function DeliveryTrackingMap({
  deliveryLat,
  deliveryLng,
  outletLat,
  outletLng,
  outletName,
  deliveryStatus,
  trackActivities = [],
  trackingUrl,
  riderName,
  riderLat,
  riderLng,
}: DeliveryTrackingMapProps) {
  const [lastScanCoords, setLastScanCoords] = useState<[number, number] | null>(null);
  const [geocodingScan, setGeocodingScan] = useState(false);

  const lastActivity = useMemo(() => {
    if (!trackActivities.length) return null;
    return trackActivities[trackActivities.length - 1];
  }, [trackActivities]);

  useEffect(() => {
    if (!lastActivity?.location?.trim()) {
      setLastScanCoords(null);
      return;
    }
    let cancelled = false;
    setGeocodingScan(true);
    forwardGeocode(lastActivity.location).then((hit) => {
      if (cancelled) return;
      if (hit) setLastScanCoords([hit.lat, hit.lng]);
      else setLastScanCoords(null);
      setGeocodingScan(false);
    });
    return () => {
      cancelled = true;
    };
  }, [lastActivity?.location]);

  const deliveryPoint =
    deliveryLat != null && deliveryLng != null
      ? ([deliveryLat, deliveryLng] as [number, number])
      : null;

  const outletPoint =
    outletLat != null && outletLng != null
      ? ([outletLat, outletLng] as [number, number])
      : null;

  const riderExplicitPoint =
    riderLat != null && riderLng != null
      ? ([riderLat, riderLng] as [number, number])
      : null;

  const riderPoint = riderExplicitPoint ?? lastScanCoords;

  const mapPoints = useMemo(() => {
    const pts: [number, number][] = [];
    if (outletPoint) pts.push(outletPoint);
    if (deliveryPoint) pts.push(deliveryPoint);
    if (riderPoint) pts.push(riderPoint);
    return pts;
  }, [outletPoint, deliveryPoint, riderPoint]);

  const isDelivered = deliveryStatus === "delivered";
  const isEnRoute = ["picked_up", "out_for_delivery"].includes(deliveryStatus);
  const isAssigned = ["rider_assigned", "awaiting_rider"].includes(deliveryStatus);

  const mapCenter = riderPoint ?? deliveryPoint ?? outletPoint ?? DEFAULT_CENTER;
  const canShowMap = deliveryPoint != null;

  if (!canShowMap) {
    return (
      <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
        Delivery map will appear once your delivery address pin is saved on the order.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: 230 }}>
        <MapContainer
          center={mapCenter}
          zoom={14}
          style={{ height: "100%", width: "100%" }}
          zoomControl
          scrollWheelZoom={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
          />
          <MapSizeInvalidator />
          <FitBounds points={mapPoints} />

          {outletPoint && (
            <Marker position={outletPoint} icon={restaurantIcon}>
              <Popup>{outletName || "Restaurant"}</Popup>
            </Marker>
          )}

          <Marker position={deliveryPoint} icon={isDelivered ? deliveredIcon : deliveryIcon}>
            <Popup>{isDelivered ? "Delivered here" : "Delivery address"}</Popup>
          </Marker>

          {riderPoint && !isDelivered && (
            <Marker position={riderPoint} icon={riderName ? pinIcon("#2563eb", `🏍 ${riderName}`) : riderIcon}>
              <Popup>
                <div className="text-xs">
                  <p className="font-semibold text-primary">{riderName || "Rider"}</p>
                  <p className="text-gray-500">
                    {isEnRoute
                      ? "Out for delivery"
                      : isAssigned
                      ? "Rider assigned — heading to restaurant"
                      : "Current location"}
                  </p>
                </div>
              </Popup>
            </Marker>
          )}

          {lastScanCoords && !riderExplicitPoint && lastActivity && !isDelivered && (
            <Marker position={lastScanCoords} icon={scanIcon}>
              <Popup>
                <span className="text-xs">
                  {lastActivity.activity}
                  {lastActivity.location ? ` — ${lastActivity.location}` : ""}
                </span>
              </Popup>
            </Marker>
          )}

          {/* Route line when Rider is assigned & heading to outlet */}
          {isAssigned && riderPoint && outletPoint && (
            <Polyline
              positions={[riderPoint, outletPoint]}
              pathOptions={{ color: "#2563eb", weight: 3, dashArray: "6 6" }}
            />
          )}

          {/* Route line to Delivery point */}
          {deliveryPoint && (
            <Polyline
              positions={
                isEnRoute && riderPoint
                  ? [riderPoint, deliveryPoint]
                  : outletPoint
                  ? [outletPoint, deliveryPoint]
                  : []
              }
              pathOptions={{
                color: isDelivered ? "#16a34a" : isEnRoute ? "#7c3aed" : "#94a3b8",
                weight: 4,
                dashArray: isEnRoute || isDelivered ? undefined : "8 8",
              }}
            />
          )}
        </MapContainer>
      </div>

      {geocodingScan && (
        <p className="text-[11px] text-gray-400 flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Updating live location…
        </p>
      )}

      {lastActivity && !geocodingScan && (
        <p className="text-xs text-gray-600">
          <span className="font-medium">Latest status:</span> {lastActivity.activity}
          {lastActivity.location ? ` at ${lastActivity.location}` : ""}
          {lastActivity.date ? ` · ${lastActivity.date}` : ""}
        </p>
      )}

      {riderName && (
        <p className="text-xs text-gray-700 font-medium flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
          Rider: <span className="font-semibold text-gray-900">{riderName}</span>
        </p>
      )}

      {trackingUrl && (
        <a
          href={trackingUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline mt-1"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open live courier map
        </a>
      )}
    </div>
  );
}

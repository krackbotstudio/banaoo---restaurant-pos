/**
 * Brand-level ordering app: /order/:slug
 * Shows all outlets for a brand, GPS-sorted, with a Leaflet map.
 * Customer selects their nearest/preferred outlet → ordering flow.
 */
import { useEffect, useState, useCallback } from "react";
import { GoogleMapView } from "@/components/map/GoogleMapView";
import { useParams } from "react-router-dom";
import { CustomerProvider } from "@/context/customer-context";
import { OutletOrderingFlow, OutletData } from "./OutletOrderingFlow";
import { API_URL } from "@/lib/api-url";
import {
  Loader2, UtensilsCrossed, MapPin, Navigation, ChevronRight, Clock,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { brandColorCssVars } from "@/lib/brand-color";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const userIcon = new L.DivIcon({
  html: `<div style="width:14px;height:14px;background:#3B82F6;border:3px solid white;border-radius:50%;box-shadow:0 0 0 3px rgba(59,130,246,0.3)"></div>`,
  className: "",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

interface BrandProfile {
  user_id: string;
  brand_name: string | null;
  full_name: string;
  ordering_slug: string;
  business_type: string | null;
  logo_url: string | null;
  brand_color: string | null;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function FitBounds({ outlets, userLatLng }: { outlets: OutletData[]; userLatLng: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    const points: [number, number][] = outlets
      .filter((o) => o.latitude && o.longitude)
      .map((o) => [o.latitude!, o.longitude!]);
    if (userLatLng) points.push(userLatLng);
    if (points.length >= 2) {
      map.fitBounds(points, { padding: [40, 40] });
    } else if (points.length === 1) {
      map.setView(points[0], 15);
    }
  }, [outlets, userLatLng]);
  return null;
}

interface OutletWithDistance extends OutletData {
  distance?: number; // km
}

// ── Outlet Selector Page ──────────────────────────────────────────────────────
function OutletSelectorPage({
  brand,
  outlets,
  onSelect,
}: {
  brand: BrandProfile;
  outlets: OutletWithDistance[];
  onSelect: (outlet: OutletData) => void;
}) {
  const [userLatLng, setUserLatLng] = useState<[number, number] | null>(null);
  const { getImageUrl } = useAuth();
  const [locating, setLocating] = useState(false);
  const [sortedOutlets, setSortedOutlets] = useState<OutletWithDistance[]>(outlets);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "locating" | "done" | "denied">("idle");

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) { setGpsStatus("denied"); return; }
    setLocating(true);
    setGpsStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLatLng([latitude, longitude]);
        setGpsStatus("done");
        setLocating(false);
        const withDist = outlets.map((o) => ({
          ...o,
          distance:
            o.latitude && o.longitude
              ? haversineKm(latitude, longitude, o.latitude, o.longitude)
              : undefined,
        }));
        withDist.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
        setSortedOutlets(withDist);
      },
      () => {
        setGpsStatus("denied");
        setLocating(false);
      },
      { timeout: 10000 }
    );
  }, [outlets]);

  // Auto-request location on mount
  useEffect(() => { requestLocation(); }, []);

  const brandDisplayName = brand.brand_name || brand.full_name;
  const hasCoords = outlets.some((o) => o.latitude && o.longitude);
  const brandVars = brandColorCssVars(brand.brand_color);
  const mapCenter: [number, number] =
    sortedOutlets[0]?.latitude && sortedOutlets[0]?.longitude
      ? [sortedOutlets[0].latitude!, sortedOutlets[0].longitude!]
      : [20.5937, 78.9629];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto" style={brandVars}>
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-5 pt-8 pb-5">
        {brand.logo_url ? (
          <img
            src={getImageUrl(brand.logo_url)}
            alt={brandDisplayName}
            className="h-14 w-14 mx-auto mb-3 rounded-xl object-contain"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary mx-auto mb-3">
            <UtensilsCrossed className="h-6 w-6 text-primary-foreground" />
          </div>
        )}
        <h1 className="font-bold text-xl text-gray-900 text-center">{brandDisplayName}</h1>
        {brand.business_type && (
          <p className="text-xs text-gray-400 text-center mt-0.5 capitalize">
            {brand.business_type.replace("_", " ")}
          </p>
        )}
      </div>

      {/* Google Map (only if outlets have coordinates) */}
      {hasCoords && (
        <div className="h-48 border-b border-gray-200">
          <GoogleMapView
            center={{ lat: mapCenter[0], lng: mapCenter[1] }}
            zoom={12}
            markers={[
              ...(userLatLng
                ? [
                    {
                      id: "user-location-pin",
                      lat: userLatLng[0],
                      lng: userLatLng[1],
                      title: "Your Location",
                      popupContent: <p className="font-semibold text-xs">Your Location</p>,
                    },
                  ]
                : []),
              ...sortedOutlets
                .filter((o) => o.latitude && o.longitude)
                .map((o) => ({
                  id: `outlet-pin-${o.id}`,
                  lat: o.latitude!,
                  lng: o.longitude!,
                  title: o.name,
                  popupContent: (
                    <div className="text-xs space-y-0.5">
                      <p className="font-bold text-gray-900">{o.name}</p>
                      {o.address && <p className="text-gray-500">{o.address}</p>}
                      {o.distance != null && (
                        <p className="text-gray-400 font-medium">{formatDistance(o.distance)} away</p>
                      )}
                    </div>
                  ),
                })),
            ]}
          />
        </div>
      )}

      {/* GPS Status */}
      <div className="px-5 pt-4 pb-1">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-sm text-gray-800">
            {gpsStatus === "done" ? "Outlets near you" : "Select an outlet"}
          </h2>
          <button
            onClick={requestLocation}
            disabled={locating}
            className="flex items-center gap-1.5 text-xs text-primary font-semibold"
          >
            {locating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Navigation className="h-3.5 w-3.5" />
            )}
            {gpsStatus === "denied" ? "Retry location" : gpsStatus === "done" ? "Refresh" : "Use GPS"}
          </button>
        </div>
        {gpsStatus === "denied" && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg mb-3">
            Location access denied. Outlets are shown without distance sorting.
          </p>
        )}
      </div>

      {/* Outlet List */}
      <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-3">
        {sortedOutlets.map((outlet, idx) => (
          <button
            key={outlet.id}
            onClick={() => onSelect(outlet)}
            className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 text-left hover:border-primary/40 hover:shadow-md transition-all"
          >
            {/* Nearest badge */}
            <div
              className={`flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center ${
                idx === 0 && gpsStatus === "done" ? "bg-primary" : "bg-gray-100"
              }`}
            >
              <UtensilsCrossed
                className={`h-5 w-5 ${idx === 0 && gpsStatus === "done" ? "text-primary-foreground" : "text-gray-500"}`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate">{outlet.name}</p>
                  {outlet.address && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate flex items-center gap-1">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      {outlet.address}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {outlet.distance != null && (
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      {formatDistance(outlet.distance)}
                    </span>
                  )}
                  {idx === 0 && gpsStatus === "done" && (
                    <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                      Nearest
                    </span>
                  )}
                </div>
              </div>
              {(outlet.opening_time || outlet.closing_time) && (
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {outlet.opening_time} – {outlet.closing_time}
                </p>
              )}
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main BrandApp ─────────────────────────────────────────────────────────────
export default function BrandApp() {
  const { slug } = useParams<{ slug: string }>();
  const [brand, setBrand] = useState<BrandProfile | null>(null);
  const [outlets, setOutlets] = useState<OutletWithDistance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOutlet, setSelectedOutlet] = useState<OutletData | null>(null);

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/api/public/brands/${encodeURIComponent(slug)}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json.error || "Brand not found. Check your link and try again.");
          setLoading(false);
          return;
        }

        setBrand(json.brand as BrandProfile);
        const outletList = (json.outlets ?? []).map((o: any) => ({
          ...o,
          owner_id: json.brand.user_id,
        })) as OutletWithDistance[];
        setOutlets(outletList);
        if (outletList.length === 1) setSelectedOutlet(outletList[0]);
      } catch {
        setError("Unable to load restaurant. Please check your connection and try again.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !brand) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4 p-8 text-center">
        <UtensilsCrossed className="h-12 w-12 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-700">Restaurant not found</h2>
        <p className="text-gray-500 text-sm">{error}</p>
      </div>
    );
  }

  if (outlets.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4 p-8 text-center">
        <UtensilsCrossed className="h-12 w-12 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-700">{brand.brand_name || brand.full_name}</h2>
        <p className="text-gray-500 text-sm">No outlets are currently accepting orders.</p>
      </div>
    );
  }

  return (
    <CustomerProvider ownerId={brand?.user_id}>
      {selectedOutlet ? (
        <OutletOrderingFlow
          outlet={selectedOutlet}
          basePath={`/order/${slug}/outlet/${selectedOutlet.id}`}
          onChangeOutlet={outlets.length > 1 ? () => setSelectedOutlet(null) : undefined}
          branding={{ logo_url: brand.logo_url, brand_color: brand.brand_color, brand_name: brand.brand_name }}
        />
      ) : (
        <OutletSelectorPage
          brand={brand}
          outlets={outlets}
          onSelect={setSelectedOutlet}
        />
      )}
    </CustomerProvider>
  );
}

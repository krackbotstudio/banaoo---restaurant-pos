import { useState, useEffect, useRef } from "react";
import { useCustomer, CustomerAddress } from "@/context/customer-context";
import { MapPin, Navigation, Loader2, ArrowRight } from "lucide-react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix leaflet default marker icon
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const ADDRESS_LABELS = ["Home", "Work", "Other"];

const DEFAULT_LAT = 20.5937;
const DEFAULT_LNG = 78.9629;
const DEFAULT_ZOOM = 5;
const PINNED_ZOOM = 16;

// ── Map sub-components (must be module-level, not nested) ──────────────────────

function MapClickHandler({ onMove }: { onMove: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMove(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FlyToLocation({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], zoom, { animate: true, duration: 0.8 });
  }, [lat, lng, zoom, map]);
  return null;
}

// Fixes Leaflet rendering when map container becomes visible conditionally
function MapSizeInvalidator() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

// ──────────────────────────────────────────────────────────────────────────────

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    return data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

interface CustomerSetupPageProps {
  phone: string;
  onDone: () => void;
}

export default function CustomerSetupPage({ phone, onDone }: CustomerSetupPageProps) {
  const { saveCustomer, loading } = useCustomer();
  const [name, setName] = useState("");
  const [addressText, setAddressText] = useState("");
  const [label, setLabel] = useState("Home");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState("");
  const [showMap, setShowMap] = useState(false);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMarkerMove = (newLat: number, newLng: number) => {
    setLat(newLat);
    setLng(newLng);
    setMapZoom(PINNED_ZOOM);
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    setGeocoding(true);
    geocodeTimer.current = setTimeout(async () => {
      const addr = await reverseGeocode(newLat, newLng);
      setAddressText(addr);
      setGeocoding(false);
    }, 600);
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLat(latitude);
        setLng(longitude);
        setMapZoom(PINNED_ZOOM);
        setShowMap(true);
        setGeocoding(true);
        const addr = await reverseGeocode(latitude, longitude);
        setAddressText(addr);
        setGeocoding(false);
        setLocating(false);
      },
      (err) => {
        const msg =
          err.code === 1
            ? "Location permission denied. Please allow location access and try again."
            : err.code === 3
            ? "Location request timed out. Please try again or pin manually."
            : "Could not get your location. Please pin manually.";
        setError(msg);
        setLocating(false);
        setShowMap(true);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Please enter your name"); return; }

    const address: CustomerAddress | undefined = addressText.trim()
      ? { label, address_text: addressText.trim(), lat, lng, is_default: true }
      : undefined;

    const result = await saveCustomer(phone, name.trim(), address);
    if (result) onDone();
    else setError("Something went wrong. Please try again.");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      <div className="bg-white border-b border-gray-100 px-6 py-5">
        <h2 className="font-bold text-xl text-gray-900">Tell us about yourself</h2>
        <p className="text-sm text-gray-500 mt-0.5">We'll save this for future orders</p>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 px-6 py-5 space-y-5 overflow-y-auto pb-24">
        {/* Name */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
            Your Name *
          </label>
          <input
            type="text"
            placeholder="Enter your full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="w-full bg-white border-2 border-gray-200 rounded-2xl px-4 py-3 text-base text-gray-900 focus:outline-none focus:border-primary transition-colors placeholder-gray-300"
          />
        </div>

        {/* Delivery Address */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
            Delivery Address <span className="text-gray-400 font-normal">(optional)</span>
          </label>

          <div className="space-y-3">
            {/* Location Buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={locating}
                className="flex-1 flex items-center justify-center gap-2 bg-primary/10 text-primary border-2 border-primary/20 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60 active:scale-95 transition-all"
              >
                {locating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Navigation className="h-4 w-4" />
                )}
                {locating ? "Getting location…" : "Use my location"}
              </button>
              <button
                type="button"
                onClick={() => setShowMap(true)}
                className="flex items-center justify-center gap-2 bg-white border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-600 active:scale-95 transition-all"
              >
                <MapPin className="h-4 w-4" />
                Pin on map
              </button>
            </div>

            {/* Map */}
            {showMap && (
              <div
                className="rounded-2xl overflow-hidden border-2 border-gray-200"
                style={{ height: 240 }}
              >
                <MapContainer
                  center={[lat ?? DEFAULT_LAT, lng ?? DEFAULT_LNG]}
                  zoom={lat ? PINNED_ZOOM : DEFAULT_ZOOM}
                  style={{ height: "100%", width: "100%" }}
                  zoomControl
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
                  />
                  {/* Critical: fixes blank map when container becomes visible conditionally */}
                  <MapSizeInvalidator />
                  <MapClickHandler onMove={handleMarkerMove} />
                  {lat !== null && lng !== null && (
                    <>
                      <Marker
                        position={[lat, lng]}
                        draggable
                        eventHandlers={{
                          dragend: (e) => {
                            const m = e.target as L.Marker;
                            const pos = m.getLatLng();
                            handleMarkerMove(pos.lat, pos.lng);
                          },
                        }}
                      />
                      <FlyToLocation lat={lat} lng={lng} zoom={mapZoom} />
                    </>
                  )}
                </MapContainer>
              </div>
            )}

            {showMap && !lat && (
              <p className="text-xs text-gray-400 text-center">
                Tap anywhere on the map to drop your pin
              </p>
            )}

            {/* Address text field */}
            <div className="relative">
              {geocoding && (
                <div className="absolute right-3 top-3">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                </div>
              )}
              <textarea
                rows={2}
                placeholder="Full address (auto-filled from map, or type manually)"
                value={addressText}
                onChange={(e) => setAddressText(e.target.value)}
                className="w-full bg-white border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary transition-colors placeholder-gray-300 resize-none"
              />
            </div>

            {/* Address label */}
            {addressText && (
              <div className="flex gap-2">
                {ADDRESS_LABELS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLabel(l)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors ${
                      label === l
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-gray-200 text-gray-600 bg-white"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}
      </form>

      {/* Submit button */}
      <div className="sticky bottom-0 px-6 pb-6 pt-3 bg-gray-50 border-t border-gray-100">
        <button
          onClick={handleSubmit}
          disabled={loading || !name.trim()}
          className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-2xl text-base flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-all"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              Save & Browse Menu
              <ArrowRight className="h-5 w-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

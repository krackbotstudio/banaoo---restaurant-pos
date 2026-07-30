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

import { searchLocationCandidates, resolvePlaceDetails, reverseGeocode, type ForwardGeocodeResult } from "@/lib/geocoding";
import { Search } from "lucide-react";

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

  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ForwardGeocodeResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const triggerSearch = async (q: string) => {
    if (q.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    setSearching(true);
    const hits = await searchLocationCandidates(q, lat, lng);
    setSearchResults(hits);
    setShowDropdown(true);
    setSearching(false);
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (val.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    debounceTimer.current = setTimeout(() => {
      void triggerSearch(val);
    }, 350);
  };

  const handleSelectSearchHit = async (hit: ForwardGeocodeResult) => {
    let targetLat = hit.lat;
    let targetLng = hit.lng;
    let targetAddr = hit.displayName;

    if (hit.place_id && (targetLat === 0 || targetLng === 0)) {
      setSearching(true);
      const details = await resolvePlaceDetails(hit.place_id);
      setSearching(false);
      if (details) {
        targetLat = details.lat;
        targetLng = details.lng;
        targetAddr = details.address || details.name || hit.displayName;
      }
    }

    if (targetLat !== 0 || targetLng !== 0) {
      setShowDropdown(false);
      setSearchQuery(hit.title || targetAddr.split(",")[0] || targetAddr);
      handleMarkerMove(targetLat, targetLng);
    }
  };

  const handleMarkerMove = (newLat: number, newLng: number) => {
    setLat(newLat);
    setLng(newLng);
    setMapZoom(PINNED_ZOOM);
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    setGeocoding(true);
    geocodeTimer.current = setTimeout(async () => {
      const result = await reverseGeocode(newLat, newLng);
      setAddressText(result.addressText);
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
        const result = await reverseGeocode(latitude, longitude);
        setAddressText(result.addressText);
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

            {/* Google Places Search & Map */}
            <div ref={searchContainerRef} className="relative z-[1000]">
              <div className="relative flex items-center">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search area, landmark, street, city..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
                  className="w-full pl-9 pr-9 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {showDropdown && searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-background border border-border rounded-xl shadow-lg max-h-52 overflow-y-auto z-[1001] py-1">
                  {searchResults.map((hit, idx) => (
                    <button
                      key={hit.place_id || idx}
                      type="button"
                      className="w-full text-left px-3 py-2 text-xs hover:bg-muted/70 flex items-start gap-2 border-b border-border/40 last:border-b-0"
                      onClick={() => void handleSelectSearchHit(hit)}
                    >
                      <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{hit.title || hit.displayName}</p>
                        {hit.subtitle && <p className="text-[11px] text-muted-foreground truncate">{hit.subtitle}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

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

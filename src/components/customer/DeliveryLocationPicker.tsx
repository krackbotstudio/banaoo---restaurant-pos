import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@/lib/leaflet-setup";
import { Loader2, MapPin, Navigation } from "lucide-react";
import { reverseGeocode } from "@/lib/geocoding";

const DEFAULT_LAT = 20.5937;
const DEFAULT_LNG = 78.9629;
const DEFAULT_ZOOM = 5;
const PINNED_ZOOM = 16;

export interface DeliveryLocationValue {
  addressText: string;
  pincode: string;
  city: string;
  state: string;
  lat: number | null;
  lng: number | null;
}

interface DeliveryLocationPickerProps {
  value: DeliveryLocationValue;
  onChange: (patch: Partial<DeliveryLocationValue>) => void;
  locationError?: string;
  onLocationError?: (message: string) => void;
}

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

function MapSizeInvalidator() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

export function DeliveryLocationPicker({
  value,
  onChange,
  locationError,
  onLocationError,
}: DeliveryLocationPickerProps) {
  const [mapZoom, setMapZoom] = useState(value.lat != null ? PINNED_ZOOM : DEFAULT_ZOOM);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyCoordinates = (newLat: number, newLng: number) => {
    setMapZoom(PINNED_ZOOM);
    onChange({ lat: newLat, lng: newLng });
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    setGeocoding(true);
    geocodeTimer.current = setTimeout(async () => {
      const result = await reverseGeocode(newLat, newLng);
      onChange({
        lat: newLat,
        lng: newLng,
        addressText: result.addressText,
        pincode: result.pincode || value.pincode,
        city: result.city || value.city,
        state: result.state || value.state,
      });
      setGeocoding(false);
    }, 600);
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      onLocationError?.("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    onLocationError?.("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setGeocoding(true);
        const result = await reverseGeocode(latitude, longitude);
        onChange({
          lat: latitude,
          lng: longitude,
          addressText: result.addressText,
          pincode: result.pincode || value.pincode,
          city: result.city || value.city,
          state: result.state || value.state,
        });
        setMapZoom(PINNED_ZOOM);
        setGeocoding(false);
        setLocating(false);
      },
      (err) => {
        const msg =
          err.code === 1
            ? "Location permission denied. Allow location access or pin on the map."
            : err.code === 3
              ? "Location request timed out. Pin your location on the map."
              : "Could not get your location. Pin your location on the map.";
        onLocationError?.(msg);
        setLocating(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  return (
    <div className="space-y-3">
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
      </div>

      {locationError && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {locationError}
        </p>
      )}

      <div
        className="rounded-xl overflow-hidden border-2 border-gray-200"
        style={{ height: 220 }}
      >
        <MapContainer
          center={[value.lat ?? DEFAULT_LAT, value.lng ?? DEFAULT_LNG]}
          zoom={value.lat != null ? PINNED_ZOOM : DEFAULT_ZOOM}
          style={{ height: "100%", width: "100%" }}
          zoomControl
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
          />
          <MapSizeInvalidator />
          <MapClickHandler onMove={applyCoordinates} />
          {value.lat != null && value.lng != null && (
            <>
              <Marker
                position={[value.lat, value.lng]}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const m = e.target as L.Marker;
                    const pos = m.getLatLng();
                    applyCoordinates(pos.lat, pos.lng);
                  },
                }}
              />
              <FlyToLocation lat={value.lat} lng={value.lng} zoom={mapZoom} />
            </>
          )}
        </MapContainer>
      </div>

      {!value.lat && (
        <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
          <MapPin className="h-3 w-3" />
          Tap the map or use your location to set the delivery pin
        </p>
      )}

      <div className="relative">
        {geocoding && (
          <div className="absolute right-3 top-3 z-10">
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          </div>
        )}
        <textarea
          rows={2}
          value={value.addressText}
          onChange={(e) => onChange({ addressText: e.target.value })}
          placeholder="Full delivery address"
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={value.pincode}
          onChange={(e) =>
            onChange({ pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })
          }
          placeholder="Pincode *"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <input
          type="text"
          value={value.city}
          onChange={(e) => onChange({ city: e.target.value })}
          placeholder="City *"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <input
          type="text"
          value={value.state}
          onChange={(e) => onChange({ state: e.target.value })}
          placeholder="State *"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
    </div>
  );
}

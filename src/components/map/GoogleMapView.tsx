import React, { useCallback, useRef } from "react";
import { GoogleMap, useJsApiLoader, Marker, Polyline, InfoWindow } from "@react-google-maps/api";
import { Loader2 } from "lucide-react";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

export interface MapMarkerItem {
  id?: string;
  lat: number;
  lng: number;
  title?: string;
  draggable?: boolean;
  onDragEnd?: (lat: number, lng: number) => void;
  icon?: string | google.maps.Icon | google.maps.Symbol;
  popupContent?: React.ReactNode;
}

export interface GoogleMapViewProps {
  center: { lat: number; lng: number };
  zoom?: number;
  onClick?: (lat: number, lng: number) => void;
  markers?: MapMarkerItem[];
  polyline?: [number, number][];
  containerStyle?: React.CSSProperties;
  className?: string;
  options?: google.maps.MapOptions;
  children?: React.ReactNode;
}

export const defaultMapContainerStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  borderRadius: "0.5rem",
};

export function GoogleMapView({
  center,
  zoom = 15,
  onClick,
  markers = [],
  polyline = [],
  containerStyle = defaultMapContainerStyle,
  className = "",
  options,
  children,
}: GoogleMapViewProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: "banaoo-google-map-script",
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const [activeMarkerId, setActiveMarkerId] = React.useState<string | null>(null);

  const defaultOptions: google.maps.MapOptions = {
    disableDefaultUI: false,
    zoomControl: true,
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: true,
    ...options,
  };

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (onClick && e.latLng) {
        onClick(e.latLng.lat(), e.latLng.lng());
      }
    },
    [onClick]
  );

  // Attach global auth failure handler for Google Maps authentication errors (e.g. ApiProjectMapError)
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const prevHandler = (window as any).gm_authFailure;
      (window as any).gm_authFailure = () => {
        console.error(
          "❌ [Google Maps Auth Error] Google Maps JavaScript API authentication failed! " +
          "Common reasons: (1) Maps JavaScript API is NOT enabled in Google Cloud Console, " +
          "(2) Billing is not linked, (3) Key referrer restrictions mismatch, or (4) Key is invalid. " +
          "Key present: " + (GOOGLE_MAPS_API_KEY ? `Yes (${GOOGLE_MAPS_API_KEY.slice(0, 6)}...${GOOGLE_MAPS_API_KEY.slice(-4)})` : "No (EMPTY)")
        );
        if (typeof prevHandler === "function") prevHandler();
      };
    }
  }, []);

  React.useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      console.error(
        "⚠️ [GoogleMapView] VITE_GOOGLE_MAPS_API_KEY is empty/missing! " +
        "Ensure VITE_GOOGLE_MAPS_API_KEY is set in your build environment before running 'npm run build'."
      );
    } else {
      console.log(
        `🗺️ [GoogleMapView] Loaded with key: ${GOOGLE_MAPS_API_KEY.slice(0, 6)}...${GOOGLE_MAPS_API_KEY.slice(-4)}`
      );
    }
  }, []);

  if (loadError) {
    console.error("❌ [GoogleMapView] useJsApiLoader failed to load Google Maps script:", loadError);
    return (
      <div className="flex flex-col h-full w-full items-center justify-center bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-center text-xs text-destructive gap-1">
        <p className="font-semibold">Failed to load Google Maps</p>
        <p className="text-[11px] opacity-80">
          {!GOOGLE_MAPS_API_KEY
            ? "VITE_GOOGLE_MAPS_API_KEY is missing in the production build."
            : "Google Cloud rejected the key (ApiProjectMapError / network error). Check browser console logs for details."}
        </p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted/20 p-4 text-xs text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
        Loading Google Maps…
      </div>
    );
  }

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={zoom}
        onClick={handleMapClick}
        options={defaultOptions}
      >
        {markers.map((m, idx) => {
          const markerKey = m.id || `marker-${idx}-${m.lat}-${m.lng}`;
          return (
            <React.Fragment key={markerKey}>
              <Marker
                position={{ lat: m.lat, lng: m.lng }}
                draggable={m.draggable}
                onDragEnd={(e) => {
                  if (m.onDragEnd && e.latLng) {
                    m.onDragEnd(e.latLng.lat(), e.latLng.lng());
                  }
                }}
                title={m.title}
                icon={m.icon}
                onClick={() => {
                  if (m.popupContent) {
                    setActiveMarkerId(markerKey);
                  }
                }}
              />
              {m.popupContent && activeMarkerId === markerKey && (
                <InfoWindow
                  position={{ lat: m.lat, lng: m.lng }}
                  onCloseClick={() => setActiveMarkerId(null)}
                >
                  <div className="text-xs">{m.popupContent}</div>
                </InfoWindow>
              )}
            </React.Fragment>
          );
        })}

        {polyline.length > 1 && (
          <Polyline
            path={polyline.map(([lat, lng]) => ({ lat, lng }))}
            options={{
              strokeColor: "#3B82F6",
              strokeOpacity: 0.85,
              strokeWeight: 4,
            }}
          />
        )}

        {children}
      </GoogleMap>
    </div>
  );
}

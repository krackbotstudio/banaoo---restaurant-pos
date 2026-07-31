export interface ReverseGeocodeResult {
  addressText: string;
  pincode: string;
  city: string;
  state: string;
}

interface NominatimAddress {
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  suburb?: string;
  county?: string;
  state_district?: string;
  state?: string;
  region?: string;
}

function pickCity(addr: NominatimAddress): string {
  return (
    addr.city ||
    addr.town ||
    addr.village ||
    addr.suburb ||
    addr.state_district ||
    addr.county ||
    ""
  );
}

function pickState(addr: NominatimAddress): string {
  return addr.state || addr.region || "";
}

export function parseNominatimAddress(
  displayName: string,
  address: NominatimAddress | undefined,
  lat: number,
  lng: number
): ReverseGeocodeResult {
  const pincode = address?.postcode?.trim() ?? "";
  const city = pickCity(address ?? {});
  const state = pickState(address ?? {});
  const addressText =
    displayName?.trim() || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  return { addressText, pincode, city, state };
}

const NOMINATIM_HEADERS = {
  Accept: "application/json",
  "Accept-Language": "en",
} as const;

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<ReverseGeocodeResult> {
  const API_URL = import.meta.env.VITE_API_URL ?? "";

  // 1. Try Google Reverse Geocoding API via backend proxy
  try {
    const res = await fetch(`${API_URL}/api/places/reverse_geocode?lat=${lat}&lng=${lng}`, {
      credentials: "include",
    });
    if (res.ok) {
      const data = await res.json();
      if (data.addressText) {
        return {
          addressText: data.addressText,
          pincode: data.pincode || "",
          city: data.city || "",
          state: data.state || "",
        };
      }
    }
  } catch (err) {
    console.warn("Google Reverse Geocoding API unavailable, using fallback geocoder", err);
  }

  // 2. Direct client Google Maps API (if VITE_GOOGLE_MAPS_API_KEY is configured)
  const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (googleApiKey) {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleApiKey}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.status === "OK" && data.results?.[0]) {
          const first = data.results[0];
          let pincode = "";
          let city = "";
          let state = "";
          if (first.address_components) {
            for (const comp of first.address_components) {
              if (comp.types.includes("postal_code")) pincode = comp.long_name;
              if (comp.types.includes("locality")) city = comp.long_name;
              if (!city && comp.types.includes("administrative_area_level_2")) city = comp.long_name;
              if (comp.types.includes("administrative_area_level_1")) state = comp.long_name;
            }
          }
          return {
            addressText: first.formatted_address,
            pincode,
            city,
            state,
          };
        } else if (data.status !== "OK") {
          console.warn("⚠️ [Google Geocoding Client Error]", data.status, data.error_message || "");
        }
      }
    } catch (err) {
      console.error("❌ [Google Reverse Geocode Fetch Error]", err);
    }
  }

  // 3. Nominatim Fallback
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      { headers: NOMINATIM_HEADERS }
    );
    if (!res.ok) throw new Error("geocode failed");
    const data = await res.json();
    return parseNominatimAddress(
      data.display_name ?? "",
      data.address as NominatimAddress | undefined,
      lat,
      lng
    );
  } catch {
    return {
      addressText: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      pincode: "",
      city: "",
      state: "",
    };
  }
}

export interface ForwardGeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
  title?: string;
  subtitle?: string;
  place_id?: string;
  source?: string;
}

export interface LocationSearchHit {
  id: string;
  lat: number;
  lng: number;
  displayName: string;
  /** Short primary title / place name */
  title?: string;
  /** Short type / locality hint under the main label */
  subtitle?: string;
  place_id?: string;
  source?: string;
}

const forwardCache = new Map<string, ForwardGeocodeResult | null>();
const searchCache = new Map<string, LocationSearchHit[]>();

/**
 * Resolves exact lat, lng, and formatted address for a Google Place ID via backend API proxy.
 */
export async function resolvePlaceDetails(
  placeId: string
): Promise<{ lat: number; lng: number; address: string; name?: string } | null> {
  try {
    const API_URL = import.meta.env.VITE_API_URL ?? "";
    const res = await fetch(`${API_URL}/api/places/details?place_id=${encodeURIComponent(placeId)}`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.lat && data.lng) {
      return {
        lat: Number(data.lat),
        lng: Number(data.lng),
        address: data.address || "",
        name: data.name || "",
      };
    }
    return null;
  } catch {
    return null;
  }
}

type NominatimHit = {
  place_id?: number | string;
  lat: string;
  lon: string;
  display_name?: string;
  type?: string;
  class?: string;
  address?: NominatimAddress & { country?: string; postcode?: string };
};

function hitSubtitle(hit: NominatimHit): string | undefined {
  const parts = [
    hit.type && hit.type !== "yes" ? hit.type.replace(/_/g, " ") : null,
    hit.address?.city || hit.address?.town || hit.address?.village || hit.address?.suburb,
    hit.address?.state,
    hit.address?.country,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : undefined;
}

function mapNominatimHit(hit: NominatimHit): LocationSearchHit {
  const parts = (hit.display_name || "").split(",").map((s) => s.trim());
  const title = parts.slice(0, 2).join(", ");
  const subtitle = parts.slice(2).join(", ") || hitSubtitle(hit);
  return {
    id: String(hit.place_id ?? `${hit.lat},${hit.lon}`),
    lat: Number(hit.lat),
    lng: Number(hit.lon),
    title,
    subtitle,
    displayName: hit.display_name ?? `${hit.lat}, ${hit.lon}`,
    source: "nominatim",
  };
}

/** Haversine formula to compute distance in km between two coordinates. */
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Search places worldwide and return multiple selectable results.
 * Priority 1: Google Places API (Autocomplete & Place Details)
 * Priority 2: Photon OSM Autocomplete + Nominatim multi-engine fallback
 * Supports geographic proximity bias when map center coordinates are provided.
 */
export async function searchLocations(
  query: string,
  options?: { limit?: number; countrycodes?: string; biasLat?: number | null; biasLng?: number | null }
): Promise<LocationSearchHit[]> {
  const trimmed = query.trim().replace(/\s+/g, " ");
  if (trimmed.length < 2) return [];

  const limit = options?.limit ?? 8;
  const country = options?.countrycodes?.trim().toLowerCase() || "";
  const biasLat = options?.biasLat;
  const biasLng = options?.biasLng;
  const hasBias = biasLat != null && biasLng != null;

  const cacheKey = `${country}|${limit}|${hasBias ? `${biasLat},${biasLng}` : ""}|${trimmed.toLowerCase()}`;
  if (searchCache.has(cacheKey)) return searchCache.get(cacheKey) ?? [];

  const API_URL = import.meta.env.VITE_API_URL ?? "";

  // 1. Try Google Places Autocomplete backend proxy first
  try {
    let googleUrl = `${API_URL}/api/places/autocomplete?input=${encodeURIComponent(trimmed)}`;
    if (hasBias) {
      googleUrl += `&lat=${biasLat}&lng=${biasLng}`;
    }
    const gRes = await fetch(googleUrl, { credentials: "include" });
    if (gRes.ok) {
      const gData = await gRes.json();
      if (Array.isArray(gData.predictions) && gData.predictions.length > 0) {
        const googleHits: LocationSearchHit[] = gData.predictions.map((p: any) => ({
          id: `gplace-${p.place_id}`,
          place_id: p.place_id,
          lat: 0, // Will be resolved when user clicks using resolvePlaceDetails(place_id)
          lng: 0,
          title: p.title,
          subtitle: p.subtitle,
          displayName: p.displayName,
          source: "google",
        }));
        searchCache.set(cacheKey, googleHits);
        return googleHits;
      }
    }
  } catch (err) {
    console.warn("Google Places API proxy request failed, using fallback search engine", err);
  }

  const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const promises: Promise<LocationSearchHit[]>[] = [];

  // 2. Photon Autocomplete (Fast & Fuzzy Elasticsearch over OSM data)
  const photonUrl =
    `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=${limit}` +
    (hasBias ? `&lat=${biasLat}&lon=${biasLng}` : "");

  promises.push(
    fetch(photonUrl)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.features || !Array.isArray(data.features)) return [];
        return data.features.map((f: { properties: Record<string, string>; geometry: { coordinates: [number, number] } }, idx: number) => {
          const p = f.properties || {};
          const titleParts = [p.name, p.street, p.housenumber].filter(Boolean);
          const title = titleParts.length > 0 ? titleParts.join(", ") : (p.city || p.state || trimmed);
          const subParts = [p.district, p.suburb, p.city, p.state, p.postcode, p.country].filter(
            (b) => Boolean(b) && !titleParts.includes(b as string)
          );
          const subtitle = Array.from(new Set(subParts)).join(", ");
          const displayName = [title, subtitle].filter(Boolean).join(", ");
          return {
            id: `photon-${idx}-${f.geometry.coordinates[1]},${f.geometry.coordinates[0]}`,
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0],
            title,
            subtitle,
            displayName,
            source: "photon",
          };
        });
      })
      .catch(() => [])
  );

  // 3. Nominatim Search
  const params = new URLSearchParams({
    q: trimmed,
    format: "json",
    addressdetails: "1",
    limit: String(limit),
  });
  if (country) params.set("countrycodes", country);
  if (hasBias) {
    params.set("viewbox", `${biasLng! - 0.5},${biasLat! + 0.5},${biasLng! + 0.5},${biasLat! - 0.5}`);
  }

  promises.push(
    fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, { headers: NOMINATIM_HEADERS })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!Array.isArray(data)) return [];
        return data.map(mapNominatimHit);
      })
      .catch(() => [])
  );

  // 4. Direct Client Google Maps API (if VITE_GOOGLE_MAPS_API_KEY is present)
  if (googleApiKey) {
    const googleUrl =
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(trimmed)}` +
      `&key=${googleApiKey}` +
      (hasBias ? `&location=${biasLat},${biasLng}&radius=50000` : "");
    promises.push(
      fetch(googleUrl)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data?.results || !Array.isArray(data.results)) return [];
          return data.results.map((r: { formatted_address: string; geometry: { location: { lat: number; lng: number } } }, idx: number) => {
            const parts = (r.formatted_address || "").split(",").map((s: string) => s.trim());
            const title = parts.slice(0, 2).join(", ");
            const subtitle = parts.slice(2).join(", ");
            return {
              id: `google-${idx}-${r.geometry.location.lat},${r.geometry.location.lng}`,
              lat: r.geometry.location.lat,
              lng: r.geometry.location.lng,
              title,
              subtitle,
              displayName: r.formatted_address,
              source: "google",
            };
          });
        })
        .catch(() => [])
    );
  }

  const resultsList = await Promise.all(promises);
  const combined = resultsList.flat();

  // Deduplicate by close distance (~100m)
  const unique: LocationSearchHit[] = [];
  for (const item of combined) {
    const isDup = unique.some((u) => distanceKm(u.lat, u.lng, item.lat, item.lng) < 0.1);
    if (!isDup) unique.push(item);
  }

  // Sort by distance if map location bias is provided
  if (hasBias) {
    unique.sort((a, b) => {
      const distA = distanceKm(biasLat!, biasLng!, a.lat, a.lng);
      const distB = distanceKm(biasLat!, biasLng!, b.lat, b.lng);
      return distA - distB;
    });
  }

  const finalHits = unique.slice(0, limit);
  searchCache.set(cacheKey, finalHits);
  return finalHits;
}

/**
 * Convenience wrapper for searchLocations returning ForwardGeocodeResult array.
 */
export async function searchLocationCandidates(
  query: string,
  biasLat?: number | null,
  biasLng?: number | null
): Promise<ForwardGeocodeResult[]> {
  const hits = await searchLocations(query, { limit: 8, biasLat, biasLng });
  return hits.map((h) => ({
    lat: h.lat,
    lng: h.lng,
    displayName: h.displayName,
    title: h.title,
    subtitle: h.subtitle,
    place_id: h.place_id,
    source: h.source,
  }));
}

/** Build progressively broader search queries for Indian addresses. */
export function buildForwardGeocodeCandidates(query: string): string[] {
  const trimmed = query.trim().replace(/\s+/g, " ");
  if (!trimmed) return [];

  const candidates: string[] = [trimmed];
  const parts = trimmed
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length > 1) {
    // Drop likely building/shop name (first segment)
    candidates.push(parts.slice(1).join(", "));
    // Locality + trailing segments
    if (parts.length > 2) {
      candidates.push(parts.slice(-2).join(", "));
    }
    candidates.push(parts.slice(1).join(" "));
  }

  const pinMatch = trimmed.match(/\b(\d{6})\b/);
  const pin = pinMatch?.[1];
  if (pin) {
    const locality = parts.find(
      (part) => !/\d{6}/.test(part) && /[a-zA-Z]/.test(part) && part.length >= 3
    );
    // Prefer later locality segments over building names
    const localityFromTail = [...parts]
      .reverse()
      .find((part) => !/\d{6}/.test(part) && /[a-zA-Z]/.test(part) && part.length >= 3);

    if (localityFromTail) {
      candidates.push(`${localityFromTail} ${pin}`);
      candidates.push(`${localityFromTail}, India`);
    }
    if (locality && locality !== localityFromTail) {
      candidates.push(`${locality} ${pin}`);
    }
    candidates.push(pin);
  }

  // Deduplicate while preserving order
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const candidate of candidates) {
    const key = candidate.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate.trim());
  }
  return unique;
}

async function nominatimSearch(query: string): Promise<ForwardGeocodeResult | null> {
  const hits = await searchLocations(query, { limit: 5, countrycodes: "in" });
  if (hits.length === 0) return null;
  const pin = query.match(/\b(\d{6})\b/)?.[1];
  const preferred =
    (pin &&
      hits.find((hit) => hit.displayName.includes(pin))) ||
    hits[0];
  return {
    lat: preferred.lat,
    lng: preferred.lng,
    displayName: preferred.displayName,
  };
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Forward-geocode an address in India.
 * Tries the full query, then broader fallbacks (locality + pincode) when
 * building/shop names are not in OpenStreetMap.
 */
export async function forwardGeocode(
  query: string
): Promise<ForwardGeocodeResult | null> {
  const key = query.trim().toLowerCase();
  if (!key) return null;
  if (forwardCache.has(key)) return forwardCache.get(key) ?? null;

  const candidates = buildForwardGeocodeCandidates(query);
  try {
    for (let i = 0; i < candidates.length; i++) {
      if (i > 0) await wait(1100); // Nominatim: max 1 request/second
      const hit = await nominatimSearch(candidates[i]);
      if (hit) {
        forwardCache.set(key, hit);
        return hit;
      }
    }
    forwardCache.set(key, null);
    return null;
  } catch {
    // Do not cache hard failures — network/CORS can be transient
    return null;
  }
}

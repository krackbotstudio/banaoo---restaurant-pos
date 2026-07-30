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
}

export interface LocationSearchHit {
  id: string;
  lat: number;
  lng: number;
  displayName: string;
  /** Short type / locality hint under the main label */
  subtitle?: string;
}

const forwardCache = new Map<string, ForwardGeocodeResult | null>();
const searchCache = new Map<string, LocationSearchHit[]>();

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
  return {
    id: String(hit.place_id ?? `${hit.lat},${hit.lon}`),
    lat: Number(hit.lat),
    lng: Number(hit.lon),
    displayName: hit.display_name ?? `${hit.lat}, ${hit.lon}`,
    subtitle: hitSubtitle(hit),
  };
}

/**
 * Search places worldwide and return multiple selectable results.
 * Used by outlet location search bars.
 */
export async function searchLocations(
  query: string,
  options?: { limit?: number; countrycodes?: string }
): Promise<LocationSearchHit[]> {
  const trimmed = query.trim().replace(/\s+/g, " ");
  if (trimmed.length < 3) return [];

  const limit = options?.limit ?? 8;
  const country = options?.countrycodes?.trim().toLowerCase() || "";
  const cacheKey = `${country}|${limit}|${trimmed.toLowerCase()}`;
  if (searchCache.has(cacheKey)) return searchCache.get(cacheKey) ?? [];

  const params = new URLSearchParams({
    q: trimmed,
    format: "json",
    addressdetails: "1",
    limit: String(limit),
  });
  if (country) params.set("countrycodes", country);

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      { headers: NOMINATIM_HEADERS }
    );
    if (!res.ok) throw new Error("geocode failed");
    const data = (await res.json()) as NominatimHit[];
    if (!Array.isArray(data) || data.length === 0) {
      searchCache.set(cacheKey, []);
      return [];
    }
    const results = data.map(mapNominatimHit);
    searchCache.set(cacheKey, results);
    return results;
  } catch {
    return [];
  }
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

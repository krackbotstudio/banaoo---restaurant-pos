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

const forwardCache = new Map<string, ForwardGeocodeResult | null>();

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
  const url =
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}` +
    `&format=json&limit=5&addressdetails=1&countrycodes=in`;
  const res = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!res.ok) throw new Error("geocode failed");
  const data = (await res.json()) as Array<{
    lat: string;
    lon: string;
    display_name?: string;
    address?: { postcode?: string };
  }>;
  if (!Array.isArray(data) || data.length === 0) return null;

  const pin = query.match(/\b(\d{6})\b/)?.[1];
  const preferred =
    (pin &&
      data.find((hit) => hit.address?.postcode === pin)) ||
    data[0];

  return {
    lat: Number(preferred.lat),
    lng: Number(preferred.lon),
    displayName: preferred.display_name ?? query,
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

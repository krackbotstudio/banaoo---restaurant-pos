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

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<ReverseGeocodeResult> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      { headers: { "Accept-Language": "en" } }
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

export async function forwardGeocode(
  query: string
): Promise<ForwardGeocodeResult | null> {
  const key = query.trim().toLowerCase();
  if (!key) return null;
  if (forwardCache.has(key)) return forwardCache.get(key) ?? null;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=in`,
      { headers: { "Accept-Language": "en" } }
    );
    if (!res.ok) throw new Error("geocode failed");
    const data = await res.json();
    const hit = data?.[0];
    if (!hit) {
      forwardCache.set(key, null);
      return null;
    }
    const result: ForwardGeocodeResult = {
      lat: Number(hit.lat),
      lng: Number(hit.lon),
      displayName: hit.display_name ?? query,
    };
    forwardCache.set(key, result);
    return result;
  } catch {
    forwardCache.set(key, null);
    return null;
  }
}

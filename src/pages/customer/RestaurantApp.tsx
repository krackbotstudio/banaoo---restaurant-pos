/**
 * Direct outlet ordering via /r/:outletId (backward-compatible link)
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CustomerProvider } from "@/context/customer-context";
import { OutletOrderingFlow, OutletData, BrandingProps } from "./OutletOrderingFlow";
import { API_URL } from "@/lib/api-url";
import { Loader2, UtensilsCrossed } from "lucide-react";

export default function RestaurantApp() {
  const { outletId } = useParams<{ outletId: string }>();
  const [outlet, setOutlet] = useState<OutletData | null>(null);
  const [branding, setBranding] = useState<BrandingProps | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!outletId) return;
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/api/public/outlets/${outletId}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(json.error || "Restaurant not found or unavailable.");
          setLoading(false);
          return;
        }

        setOutlet({
          id: json.id,
          name: json.name,
          address: json.address,
          phone: json.phone,
          opening_time: json.opening_time,
          closing_time: json.closing_time,
          latitude: json.latitude,
          longitude: json.longitude,
          owner_id: json.owner_id,
        });
        if (json.branding) {
          setBranding({
            logo_url: json.branding.logo_url,
            brand_color: json.branding.brand_color,
            brand_name: json.branding.brand_name,
          });
        }
      } catch {
        setError("Unable to load restaurant. Please check your connection and try again.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [outletId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !outlet || !outletId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4 p-8 text-center">
        <UtensilsCrossed className="h-12 w-12 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-700">Restaurant not found</h2>
        <p className="text-gray-500 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <CustomerProvider ownerId={outlet.owner_id}>
      <OutletOrderingFlow outlet={outlet} basePath={`/r/${outletId}`} branding={branding} />
    </CustomerProvider>
  );
}

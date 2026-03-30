/**
 * Direct outlet ordering via /r/:outletId (backward-compatible link)
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CustomerProvider } from "@/context/customer-context";
import { OutletOrderingFlow, OutletData, BrandingProps } from "./OutletOrderingFlow";
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
      // Fetch outlet + owner branding in parallel
      const { data: outletData, error: outletError } = await supabase
        .from("outlets")
        .select("id, name, address, phone, opening_time, closing_time, latitude, longitude, owner_id")
        .eq("id", outletId)
        .eq("is_active", true)
        .single();

      if (outletError || !outletData) {
        setError("Restaurant not found or unavailable.");
        setLoading(false);
        return;
      }

      setOutlet(outletData as OutletData);

      // Fetch owner branding
      const { data: profileData } = await supabase
        .from("profiles")
        .select("logo_url, brand_color, brand_name")
        .eq("user_id", (outletData as unknown as { owner_id: string }).owner_id)
        .maybeSingle();

      if (profileData) {
        setBranding({
          logo_url: profileData.logo_url,
          brand_color: profileData.brand_color,
          brand_name: profileData.brand_name,
        });
      }

      setLoading(false);
    };
    load();
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
    <CustomerProvider>
      <OutletOrderingFlow outlet={outlet} basePath={`/r/${outletId}`} branding={branding} />
    </CustomerProvider>
  );
}

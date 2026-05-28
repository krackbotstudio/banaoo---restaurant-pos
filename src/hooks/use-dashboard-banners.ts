import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/api-base";

export type DashboardBannerKind = "news" | "offer" | "commercial";
export type DashboardBannerTheme = "warm" | "cool" | "offer" | "violet";
export type DashboardBannerCtaAction = "open_tour" | "link" | null;

export interface DashboardBanner {
  id: string;
  kind: DashboardBannerKind;
  title: string;
  description: string;
  ctaLabel: string | null;
  href: string | null;
  ctaAction: DashboardBannerCtaAction;
  theme: DashboardBannerTheme;
}

export function useDashboardBanners(enabled = true) {
  const [banners, setBanners] = useState<DashboardBanner[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBanners = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/dashboard/banners"), { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanners([]);
        return;
      }
      setBanners((data as { banners: DashboardBanner[] }).banners ?? []);
    } catch {
      setBanners([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) void fetchBanners();
  }, [enabled, fetchBanners]);

  return { banners, loading, fetchBanners };
}

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { storage } from "../lib/storage";
import { supabase } from "../lib/supabase";

const SELECTED_OUTLET_KEY = "mobile_selected_outlet_v1";

export interface Outlet {
  id: string;
  name: string;
  gst_number?: string | null;
  gst_categories?: Record<string, number> | null;
}

interface OutletContextType {
  outlets: Outlet[];
  currentOutlet: Outlet | null;
  loading: boolean;
  canSwitchOutlets: boolean;
  setCurrentOutlet: (outlet: Outlet) => Promise<void>;
  refreshOutlets: () => Promise<void>;
}

const OutletContext = createContext<OutletContextType | undefined>(undefined);

export function OutletProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [currentOutlet, setCurrentOutletState] = useState<Outlet | null>(null);
  const [loading, setLoading] = useState(true);
  const canSwitchOutlets = profile?.role === "owner" || profile?.role === "manager";

  const refreshOutlets = async () => {
    if (!user || !profile) {
      setOutlets([]);
      setCurrentOutletState(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let rows: Outlet[] = [];
      if (profile.role === "owner") {
        const { data } = await supabase
          .from("outlets")
          .select("id, name, gst_number, gst_categories")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false });
        rows = (data ?? []) as Outlet[];
      } else {
        const { data } = await supabase
          .from("staff_outlet_assignments")
          .select("outlet_id, outlets(id, name, gst_number, gst_categories)")
          .eq("user_id", user.id);
        rows =
          data?.map((item: any) => item.outlets).filter(Boolean).map((item: any) => ({
            id: item.id,
            name: item.name,
            gst_number: item.gst_number,
            gst_categories: item.gst_categories,
          })) ?? [];
      }

      setOutlets(rows);
      const savedOutletId = await storage.getItem<string>(SELECTED_OUTLET_KEY);
      const selected = rows.find((outlet) => outlet.id === savedOutletId) ?? rows[0] ?? null;
      setCurrentOutletState(selected);
      if (selected) await storage.setItem(SELECTED_OUTLET_KEY, selected.id);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshOutlets();
  }, [user?.id, profile?.role]);

  const setCurrentOutlet = async (outlet: Outlet) => {
    setCurrentOutletState(outlet);
    await storage.setItem(SELECTED_OUTLET_KEY, outlet.id);
  };

  const value = useMemo(
    () => ({
      outlets,
      currentOutlet,
      loading,
      canSwitchOutlets,
      setCurrentOutlet,
      refreshOutlets,
    }),
    [outlets, currentOutlet, loading, canSwitchOutlets]
  );

  return <OutletContext.Provider value={value}>{children}</OutletContext.Provider>;
}

export function useOutlet() {
  const ctx = useContext(OutletContext);
  if (!ctx) throw new Error("useOutlet must be used inside OutletProvider");
  return ctx;
}

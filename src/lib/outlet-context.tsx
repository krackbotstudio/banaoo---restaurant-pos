import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

interface Outlet {
  id: string;
  name: string;
  gst_number?: string | null;
  gst_categories?: Record<string, number> | null;
  operation_mode?: string | null;
  is_active?: boolean;
}

interface OutletContextType {
  currentOutlet: Outlet | null;
  outlets: Outlet[];
  setCurrentOutlet: (outlet: Outlet) => void;
  refreshOutlets: () => Promise<void>;
  loading: boolean;
  canSwitchOutlets: boolean;
}

const OutletContext = createContext<OutletContextType | undefined>(undefined);

const STORAGE_KEY = "selectedOutletId";

export function OutletProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [currentOutlet, setCurrentOutletState] = useState<Outlet | null>(null);
  const [loading, setLoading] = useState(true);

  // Only owners and managers can switch outlets
  const canSwitchOutlets = profile?.role === "owner" || profile?.role === "manager";

  useEffect(() => {
    if (user && profile) {
      void fetchOutlets();
    } else {
      setOutlets([]);
      setCurrentOutletState(null);
      setLoading(false);
    }
  }, [user, profile]);

  const fetchOutlets = async () => {
    setLoading(true);
    
    try {
      let data: Outlet[] = [];
      
      if (profile?.role === "owner") {
        // Owners can see all their outlets
        const { data: ownerOutlets } = await supabase
          .from("outlets")
          .select("id, name, gst_number, gst_categories, operation_mode, is_active")
          .eq("owner_id", user!.id)
          .order("created_at", { ascending: false });
        data = ownerOutlets || [];
      } else {
        // Staff members see outlets they're assigned to
        const { data: assignments } = await supabase
          .from("staff_outlet_assignments")
          .select("outlet_id, outlets(id, name, gst_number, gst_categories, operation_mode, is_active)")
          .eq("user_id", user!.id);
        
        if (assignments) {
          data = assignments
            .map((a: any) => a.outlets)
            .filter(Boolean) as Outlet[];
        }
      }

      setOutlets(data);

      const enabledOutlet = data.find((o) => o.is_active);
      const savedOutletId = localStorage.getItem(STORAGE_KEY);
      const savedOutlet = data.find((o) => o.id === savedOutletId);

      const next =
        enabledOutlet ??
        (savedOutlet?.is_active !== false ? savedOutlet : null) ??
        data[0] ??
        null;

      if (next) {
        setCurrentOutletState(next);
        localStorage.setItem(STORAGE_KEY, next.id);
      } else {
        setCurrentOutletState(null);
      }
    } catch (error) {
      console.error("Error fetching outlets:", error);
    }
    
    setLoading(false);
  };

  const setCurrentOutlet = (outlet: Outlet) => {
    setCurrentOutletState(outlet);
    localStorage.setItem(STORAGE_KEY, outlet.id);
  };

  return (
    <OutletContext.Provider
      value={{
        currentOutlet,
        outlets,
        setCurrentOutlet,
        refreshOutlets: fetchOutlets,
        loading,
        canSwitchOutlets,
      }}
    >
      {children}
    </OutletContext.Provider>
  );
}

export function useOutlet() {
  const context = useContext(OutletContext);
  if (context === undefined) {
    throw new Error("useOutlet must be used within an OutletProvider");
  }
  return context;
}

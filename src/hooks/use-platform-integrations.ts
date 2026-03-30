import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOutlet } from "@/lib/outlet-context";

interface PlatformIntegration {
  id: string;
  platform: string;
  is_active: boolean;
  status: string;
  last_synced_at: string | null;
  webhook_url: string | null;
}

export function usePlatformIntegrations() {
  const { currentOutlet } = useOutlet();
  const [integrations, setIntegrations] = useState<PlatformIntegration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentOutlet) {
      fetchIntegrations();
    }
  }, [currentOutlet]);

  const fetchIntegrations = async () => {
    if (!currentOutlet) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("platform_integrations")
      .select("*")
      .eq("outlet_id", currentOutlet.id);

    if (!error && data) {
      setIntegrations(data);
    }
    setLoading(false);
  };

  const isConnected = (platform: string) => {
    const integration = integrations.find(i => i.platform === platform);
    return integration?.is_active && integration?.status === "connected";
  };

  const getConnectedPlatforms = () => {
    return integrations
      .filter(i => i.is_active && i.status === "connected")
      .map(i => i.platform);
  };

  return {
    integrations,
    loading,
    isConnected,
    getConnectedPlatforms,
    refetch: fetchIntegrations,
  };
}

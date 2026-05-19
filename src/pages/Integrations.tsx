import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOutlet } from "@/lib/outlet-context";
import { useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Link2, CheckCircle, XCircle, AlertCircle, ExternalLink,
  Settings2, Copy, Globe, MapPin,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PlatformConfigModal } from "@/components/integrations/PlatformConfigModal";
import { OrderingQRCode } from "@/components/customer/OrderingQRCode";
import { FeatureGate } from "@/components/FeatureGate";
import type { FeatureKey } from "@/hooks/use-feature-gating";

interface PlatformIntegration {
  id: string;
  platform: string;
  is_active: boolean;
  status: string;
  last_synced_at: string | null;
  webhook_url: string | null;
}

interface Platform {
  id: string;
  name: string;
  description: string;
  logo: string;
  color: string;
  available: boolean;
}

function platformFeatureKey(platformId: string): FeatureKey | null {
  if (platformId === "swiggy") return "swiggyIntegration";
  if (platformId === "zomato") return "zomatoIntegration";
  return null;
}

const PLATFORMS: Platform[] = [
  {
    id: "zomato",
    name: "Zomato",
    description: "Receive and manage orders from Zomato directly in your dashboard",
    logo: "🍽️",
    color: "bg-red-500",
    available: true,
  },
  {
    id: "swiggy",
    name: "Swiggy",
    description: "Sync your Swiggy orders for unified order management",
    logo: "🧡",
    color: "bg-orange-500",
    available: true,
  },
  {
    id: "uber_eats",
    name: "Uber Eats",
    description: "Connect Uber Eats to manage all delivery orders in one place",
    logo: "🚗",
    color: "bg-green-600",
    available: false,
  },
  {
    id: "magicpin",
    name: "Magicpin",
    description: "Integrate with Magicpin for local food delivery orders",
    logo: "📍",
    color: "bg-purple-500",
    available: false,
  },
];

export default function Integrations() {
  const { currentOutlet, outlets, loading: outletLoading } = useOutlet();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState<PlatformIntegration[]>([]);
  const [, setLoading] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);

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

  const getIntegrationStatus = (platformId: string) => {
    return integrations.find(i => i.platform === platformId);
  };

  const handleConfigurePlatform = (platform: Platform) => {
    setSelectedPlatform(platform);
    setConfigModalOpen(true);
  };

  const handleDisconnect = async (platformId: string) => {
    const integration = getIntegrationStatus(platformId);
    if (!integration) return;

    const { error } = await supabase
      .from("platform_integrations")
      .delete()
      .eq("id", integration.id);

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Disconnected", description: "Platform integration removed" });
      fetchIntegrations();
    }
  };

  const copyLink = (url: string, label: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: `${label} copied!` });
  };

  const getStatusBadge = (integration: PlatformIntegration | undefined) => {
    if (!integration) {
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Not Connected
        </Badge>
      );
    }

    if (integration.is_active && integration.status === "connected") {
      return (
        <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
          <CheckCircle className="h-3 w-3 mr-1" />
          Connected
        </Badge>
      );
    }

    if (integration.status === "error") {
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Error
        </Badge>
      );
    }

    return (
      <Badge variant="secondary">
        <AlertCircle className="h-3 w-3 mr-1" />
        {integration.status}
      </Badge>
    );
  };

  if (outletLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (outlets.length === 0) {
    return (
      <AppLayout>
        <div className="p-6 max-w-7xl mx-auto">
          <EmptyState
            icon={Link2}
            title="No Outlets Found"
            description="Create an outlet first to set up integrations"
            actionLabel="Go to Outlets"
            onAction={() => window.location.href = "/outlets"}
          />
        </div>
      </AppLayout>
    );
  }

  const origin = window.location.origin;
  const brandLink = profile?.ordering_slug ? `${origin}/order/${profile.ordering_slug}` : null;

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl gradient-primary glow-primary">
              <Link2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">Integrations</h1>
              <p className="text-sm text-muted-foreground">
                Online ordering links &amp; delivery platform connections
              </p>
            </div>
          </div>
        </div>

        {/* ── Online Ordering Links (no feature gate) ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              Online Ordering Links
            </CardTitle>
            <CardDescription>
              Share these links with customers so they can order directly from you — no third-party app needed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Brand link */}
            {brandLink ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Brand Ordering Page</p>
                    <p className="text-xs text-muted-foreground">
                      Shows all your outlets — customers see the nearest one first
                    </p>
                  </div>
                  <Badge className="bg-green-500/20 text-green-600 border-green-500/30 text-xs shrink-0 ml-2">
                    Recommended
                  </Badge>
                </div>
                <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2.5">
                  <span className="text-sm font-mono text-primary truncate flex-1">{brandLink}</span>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                    onClick={() => copyLink(brandLink, "Brand link")}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                    onClick={() => window.open(brandLink, "_blank")}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg px-4 py-3">
                Complete onboarding to get your brand ordering link.
              </div>
            )}

            {/* Per-outlet direct links */}
            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium">Direct Outlet Links</p>
                <p className="text-xs text-muted-foreground">
                  Link customers to a specific outlet (useful for single-location restaurants or WhatsApp shares)
                </p>
              </div>
              <div className="space-y-2">
                {outlets.map((outlet) => {
                  const outletLink = `${origin}/r/${outlet.id}`;
                  return (
                    <div
                      key={outlet.id}
                      className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2"
                    >
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{outlet.name}</p>
                        <p className="text-xs font-mono text-muted-foreground truncate">{outletLink}</p>
                      </div>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                        onClick={() => copyLink(outletLink, outlet.name)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                        onClick={() => window.open(outletLink, "_blank")}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      <OrderingQRCode
                        url={outletLink}
                        restaurantName={profile?.brand_name || outlet.name}
                        outletName={outlet.name}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
              Make sure each outlet has a GPS location set so customers see accurate distances. Edit outlets to add location.
            </p>
          </CardContent>
        </Card>

        {/* ── Platform Integrations (per-platform add-ons) ── */}
        <div className="space-y-6">
            {/* Info Banner */}
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Unified Order Management</p>
                  <p className="text-sm text-muted-foreground">
                    Connect your food delivery platform accounts to receive and manage all orders from one dashboard.
                    Orders will appear in real-time alongside your POS orders.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Platform Cards */}
            <div className="grid gap-4 md:grid-cols-2">
              {PLATFORMS.map((platform) => {
                const integration = getIntegrationStatus(platform.id);
                const isConnected = integration?.is_active && integration?.status === "connected";
                const featureKey = platformFeatureKey(platform.id);

                const card = (
                  <Card
                    key={platform.id}
                    className={`relative overflow-hidden transition-all duration-300 ${
                      isConnected ? "border-green-500/50" : ""
                    } ${!platform.available ? "opacity-60" : "hover:border-primary/50"}`}
                  >
                    <div className={`absolute top-0 left-0 right-0 h-1 ${platform.color}`} />

                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl ${platform.color} flex items-center justify-center text-2xl`}>
                            {platform.logo}
                          </div>
                          <div>
                            <CardTitle className="font-display text-lg flex items-center gap-2">
                              {platform.name}
                              {!platform.available && (
                                <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                              )}
                            </CardTitle>
                            <CardDescription className="text-xs mt-1">
                              {platform.description}
                            </CardDescription>
                          </div>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(integration)}
                          {integration?.last_synced_at && (
                            <span className="text-xs text-muted-foreground">
                              Last synced: {new Date(integration.last_synced_at).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {platform.available ? (
                          isConnected ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => handleConfigurePlatform(platform)}
                              >
                                <Settings2 className="h-4 w-4 mr-2" />
                                Configure
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDisconnect(platform.id)}
                              >
                                Disconnect
                              </Button>
                            </>
                          ) : (
                            <Button
                              className="flex-1"
                              onClick={() => handleConfigurePlatform(platform)}
                            >
                              <Link2 className="h-4 w-4 mr-2" />
                              Connect {platform.name}
                            </Button>
                          )
                        ) : (
                          <Button variant="outline" size="sm" className="flex-1" disabled>
                            Coming Soon
                          </Button>
                        )}
                      </div>

                      {isConnected && integration?.webhook_url && (
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground mb-1">Webhook URL</p>
                          <code className="text-xs break-all">{integration.webhook_url}</code>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );

                if (!featureKey || !platform.available) {
                  return <div key={platform.id}>{card}</div>;
                }

                return (
                  <FeatureGate key={platform.id} feature={featureKey} showUpgradePrompt>
                    {card}
                  </FeatureGate>
                );
              })}
            </div>

            {/* Help Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Need Help?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <strong>Zomato:</strong> Contact your Zomato partner manager to get API credentials for POS integration.
                </p>
                <p>
                  <strong>Swiggy:</strong> Swiggy integration requires partner API access. Contact Swiggy support for details.
                </p>
              </CardContent>
            </Card>
        </div>
      </div>

      {selectedPlatform && (
        <PlatformConfigModal
          open={configModalOpen}
          onOpenChange={setConfigModalOpen}
          platform={selectedPlatform}
          outletId={currentOutlet?.id || ""}
          onSuccess={fetchIntegrations}
        />
      )}
    </AppLayout>
  );
}

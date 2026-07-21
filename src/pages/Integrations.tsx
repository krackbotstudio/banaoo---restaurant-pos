import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOutlet } from "@/lib/outlet-context";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Link2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Settings2,
  Sparkles,
  Radio,
  HelpCircle,
  ArrowUpRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PlatformConfigModal } from "@/components/integrations/PlatformConfigModal";
import { FeatureGate } from "@/components/FeatureGate";
import type { FeatureKey } from "@/hooks/use-feature-gating";
import { Link } from "react-router-dom";
import { ShiprocketLogo } from "@/components/shiprocket/ShiprocketLogo";
import { API_URL } from "@/lib/api-url";
import { RazorpayLogo } from "@/components/razorpay/RazorpayLogo";

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
  accent: string;
  gradient: string;
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
    description: "Receive and manage Zomato orders in your kitchen display and POS.",
    logo: "🍽️",
    color: "bg-red-500",
    accent: "border-red-500/40",
    gradient: "from-red-500/15 via-red-500/5 to-transparent",
    available: true,
  },
  {
    id: "swiggy",
    name: "Swiggy",
    description: "Sync Swiggy orders into one unified queue with dine-in and takeaway.",
    logo: "🧡",
    color: "bg-orange-500",
    accent: "border-orange-500/40",
    gradient: "from-orange-500/15 via-orange-500/5 to-transparent",
    available: true,
  },
  {
    id: "uber_eats",
    name: "Uber Eats",
    description: "Connect Uber Eats for delivery order management in one dashboard.",
    logo: "🚗",
    color: "bg-green-600",
    accent: "border-green-500/30",
    gradient: "from-green-600/10 via-green-600/5 to-transparent",
    available: false,
  },
  {
    id: "magicpin",
    name: "Magicpin",
    description: "Integrate Magicpin for local discovery and delivery orders.",
    logo: "📍",
    color: "bg-purple-500",
    accent: "border-purple-500/30",
    gradient: "from-purple-500/10 via-purple-500/5 to-transparent",
    available: false,
  },
];

export default function Integrations() {
  const { currentOutlet, outlets, loading: outletLoading } = useOutlet();
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState<PlatformIntegration[]>([]);
  const [loading, setLoading] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [razorpayConnected, setRazorpayConnected] = useState(false);
  const [razorpayLoading, setRazorpayLoading] = useState(false);

  useEffect(() => {
    if (currentOutlet) {
      fetchIntegrations();
      void fetchRazorpayStatus();
    }
  }, [currentOutlet]);

  const fetchRazorpayStatus = async () => {
    if (!currentOutlet) return;
    setRazorpayLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/outlets/${currentOutlet.id}/razorpay`, {
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        setRazorpayConnected(Boolean(json.is_connected));
      }
    } catch {
      setRazorpayConnected(false);
    } finally {
      setRazorpayLoading(false);
    }
  };

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

  const connectedCount = useMemo(
    () =>
      integrations.filter((i) => i.is_active && i.status === "connected").length,
    [integrations]
  );

  const getIntegrationStatus = (platformId: string) =>
    integrations.find((i) => i.platform === platformId);

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

  const getStatusBadge = (integration: PlatformIntegration | undefined) => {
    if (!integration) {
      return (
        <Badge variant="outline" className="text-muted-foreground bg-background/80">
          Not connected
        </Badge>
      );
    }
    if (integration.is_active && integration.status === "connected") {
      return (
        <Badge className="bg-green-500/15 text-green-700 border-green-500/30 gap-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          Live
        </Badge>
      );
    }
    if (integration.status === "error") {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Error
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-1">
        <AlertCircle className="h-3 w-3" />
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
        <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-8">
          <EmptyState
            icon={Link2}
            title="No outlets yet"
            description="Create an outlet first, then connect delivery platforms."
            actionLabel="Go to Settings → Outlets"
            onAction={() => (window.location.href = "/settings?tab=outlets")}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-8">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.08] via-background to-accent/[0.06] p-6 md:p-8">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          <div className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-accent/10 blur-2xl pointer-events-none" />
          <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Delivery platform hub
              </div>
              <h1 className="font-display text-3xl font-bold tracking-tight">Integrations</h1>
              <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
                Connect Swiggy, Zomato, and more so aggregator orders flow into the same kitchen
                queue as your POS. Online ordering links for customers live on each{" "}
                <Link to="/outlets" className="text-primary font-medium hover:underline">
                  outlet&apos;s detail page
                </Link>
                .
              </p>
            </div>
            <div className="flex flex-wrap gap-3 shrink-0">
              <Card className="min-w-[140px] border-border/60 bg-background/80 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Connected</p>
                  <p className="text-2xl font-bold mt-1">{connectedCount}</p>
                </CardContent>
              </Card>
              <Card className="min-w-[140px] border-border/60 bg-background/80 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Outlet</p>
                  <p className="text-sm font-semibold mt-1 truncate max-w-[160px]">
                    {currentOutlet?.name ?? "—"}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Info strip */}
        <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3.5">
          <Radio className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm">Unified order management</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Connected platforms push orders in real time alongside dine-in and takeaway — no
              separate tablet needed.
            </p>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        )}

        {/* Platform grid */}
        <div className="grid gap-5 md:grid-cols-2">
          {PLATFORMS.map((platform) => {
            const integration = getIntegrationStatus(platform.id);
            const isConnected = integration?.is_active && integration?.status === "connected";
            const featureKey = platformFeatureKey(platform.id);

            const card = (
              <Card
                key={platform.id}
                className={`relative overflow-hidden transition-all duration-300 group ${
                  isConnected
                    ? "border-green-500/40 shadow-md shadow-green-500/5"
                    : platform.available
                      ? "hover:border-primary/35 hover:shadow-elevated"
                      : "opacity-70"
                }`}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${platform.gradient} pointer-events-none`}
                />
                <CardHeader className="relative pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-14 h-14 rounded-2xl border ${platform.accent} bg-background/90 flex items-center justify-center text-2xl shadow-sm`}
                      >
                        {platform.logo}
                      </div>
                      <div>
                        <CardTitle className="font-display text-xl flex items-center gap-2">
                          {platform.name}
                          {!platform.available && (
                            <Badge variant="secondary" className="text-[10px] font-normal">
                              Coming soon
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="text-sm mt-1 max-w-sm">
                          {platform.description}
                        </CardDescription>
                      </div>
                    </div>
                    {getStatusBadge(integration)}
                  </div>
                </CardHeader>

                <CardContent className="relative space-y-4 pt-2">
                  {integration?.last_synced_at && (
                    <p className="text-xs text-muted-foreground">
                      Last synced {new Date(integration.last_synced_at).toLocaleString()}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {platform.available ? (
                      isConnected ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 min-w-[120px] bg-background/80"
                            onClick={() => handleConfigurePlatform(platform)}
                          >
                            <Settings2 className="h-4 w-4 mr-2" />
                            Configure
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDisconnect(platform.id)}
                          >
                            Disconnect
                          </Button>
                        </>
                      ) : (
                        <Button
                          className="w-full gradient-warm text-white border-0 shadow-md"
                          onClick={() => handleConfigurePlatform(platform)}
                        >
                          <Link2 className="h-4 w-4 mr-2" />
                          Connect {platform.name}
                        </Button>
                      )
                    ) : (
                      <Button variant="outline" size="sm" className="w-full" disabled>
                        Coming soon
                      </Button>
                    )}
                  </div>

                  {isConnected && integration?.webhook_url && (
                    <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                        Webhook URL
                      </p>
                      <code className="text-xs break-all text-foreground/80">
                        {integration.webhook_url}
                      </code>
                    </div>
                  )}
                </CardContent>
              </Card>
            );

            if (!featureKey || !platform.available) {
              return card;
            }

            return (
              <FeatureGate key={platform.id} feature={featureKey} showUpgradePrompt>
                {card}
              </FeatureGate>
            );
          })}
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="font-display text-lg font-semibold">Payments</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Connect Razorpay once at restaurant level — all outlets share the same account for online checkout.
            </p>
          </div>

          <FeatureGate feature="razorpayPayments" showUpgradePrompt>
            <Card className="border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 via-background to-transparent">
              <CardHeader>
                <CardTitle className="flex items-center gap-2.5">
                  <RazorpayLogo variant="full" className="h-8" />
                  {razorpayLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Badge variant={razorpayConnected ? "default" : "secondary"}>
                      {razorpayConnected ? "Connected" : "Not connected"}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  OAuth-based connection — no API keys. Customers pay online on your ordering link; payments are tagged by outlet.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="gap-2">
                  <Link to="/settings?tab=payments">
                    <Settings2 className="h-4 w-4" />
                    Open payment settings
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </FeatureGate>

          <FeatureGate feature="googlePayIndia" showUpgradePrompt>
            <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-background to-transparent">
              <CardHeader>
                <CardTitle className="flex items-center gap-2.5">
                  <span className="font-semibold">Google Pay India</span>
                  <Badge variant="secondary">UPI</Badge>
                </CardTitle>
                <CardDescription>
                  Accept UPI via Google Pay to your merchant VPA. Choose Google Pay as your active online provider in Settings → Payments.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="gap-2" variant="outline">
                  <Link to="/settings?tab=payments">
                    <Settings2 className="h-4 w-4" />
                    Configure Google Pay
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </FeatureGate>
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="font-display text-lg font-semibold">Delivery</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Book hyperlocal food delivery riders for your outlet orders.
            </p>
          </div>

        <FeatureGate feature="shiprocketDelivery" showUpgradePrompt>
          <Card className="border-blue-500/30 bg-gradient-to-br from-blue-500/10 via-background to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2.5">
                <ShiprocketLogo variant="full" className="h-7" />
                <span>Quick — Food Delivery</span>
              </CardTitle>
              <CardDescription>
                Auto-book Shiprocket Quick 2-wheeler riders for in-city food delivery. Connect and configure in Settings → Delivery.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="gap-2">
                <Link to="/settings?tab=delivery">
                  <Settings2 className="h-4 w-4" />
                  Open Delivery settings
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </FeatureGate>
        </div>

        {/* Help + addons CTA */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                Setup help
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">Zomato:</strong> Ask your partner manager for
                POS API credentials to connect.
              </p>
              <p>
                <strong className="text-foreground">Swiggy:</strong> Partner API access is required —
                contact Swiggy support for integration details.
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.05] to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Need Swiggy or Zomato add-ons?</CardTitle>
              <CardDescription>
                Platform integrations are available as add-ons on Launcher and Growth plans.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="secondary" className="gap-2">
                <Link to="/addons">
                  Browse add-ons
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
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

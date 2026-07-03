import { useCallback, useEffect, useState } from "react";
import { useOutlet } from "@/lib/outlet-context";
import { API_URL } from "@/lib/api-url";
import { useFeatureGating } from "@/hooks/use-feature-gating";
import { FeatureGate } from "@/components/FeatureGate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Unplug } from "lucide-react";
import { RazorpayLogo } from "@/components/razorpay/RazorpayLogo";

interface RazorpayState {
  is_connected: boolean;
  connection_mode?: "oauth" | "api_keys" | null;
  connected_at: string | null;
  account_id: string | null;
  account_name: string | null;
  merchant_key_id?: string | null;
  oauth_available?: boolean;
  api_key_connect_available?: boolean;
  oauth_connect_url: string;
  oauth_callback_url?: string;
  webhook_url: string;
  entitled?: boolean;
  settings: {
    online_payments_enabled: boolean;
    allow_cod: boolean;
    allow_partial_refunds: boolean;
    has_webhook_secret: boolean;
  };
}

export function RazorpaySettingsPanel() {
  const { currentOutlet } = useOutlet();
  const { toast } = useToast();
  const { canAccess } = useFeatureGating();
  const outletId = currentOutlet?.id;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [state, setState] = useState<RazorpayState | null>(null);

  const fetchState = useCallback(async () => {
    if (!outletId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/outlets/${outletId}/razorpay`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load Razorpay settings");
      setState(json);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load Razorpay settings",
      });
    } finally {
      setLoading(false);
    }
  }, [outletId, toast]);

  useEffect(() => {
    void fetchState();
  }, [fetchState]);

  const handleConnect = async () => {
    if (!outletId) return;
    try {
      const res = await fetch(`${API_URL}/api/razorpay/oauth/start?outlet_id=${encodeURIComponent(outletId)}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not start Razorpay OAuth");
      if (!json.auth_url) throw new Error("Razorpay auth URL was not returned");
      window.location.href = json.auth_url;
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Connection failed",
        description: err instanceof Error ? err.message : "Could not connect Razorpay",
      });
    }
  };

  const handleApiKeyConnect = async () => {
    if (!outletId) return;
    setConnecting(true);
    try {
      const res = await fetch(`${API_URL}/api/outlets/${outletId}/razorpay/connect`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key_id: keyId.trim(), key_secret: keySecret.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not connect Razorpay");
      setKeySecret("");
      toast({ title: "Connected", description: "Your Razorpay account is now linked." });
      await fetchState();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Connection failed",
        description: err instanceof Error ? err.message : "Could not connect Razorpay",
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!outletId) return;
    setDisconnecting(true);
    try {
      const res = await fetch(`${API_URL}/api/outlets/${outletId}/razorpay/disconnect`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to disconnect Razorpay");
      toast({ title: "Disconnected", description: "Razorpay account disconnected." });
      await fetchState();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Could not disconnect Razorpay",
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const saveSettings = async (patch: Partial<RazorpayState["settings"]>) => {
    if (!outletId || !state) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/outlets/${outletId}/razorpay/settings`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...state.settings, ...patch }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save settings");
      setState((prev) => (prev ? { ...prev, settings: json.settings } : prev));
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save settings",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!outletId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Select an outlet to configure Razorpay.
        </CardContent>
      </Card>
    );
  }

  if (!canAccess("razorpayPayments")) {
    return (
      <FeatureGate feature="razorpayPayments">
        <div />
      </FeatureGate>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RazorpayLogo variant="full" className="h-7" />
          <span className="text-base">Payments</span>
        </CardTitle>
        <CardDescription>
          Connect one Razorpay account at restaurant level and accept online payments across all outlets.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant={state?.is_connected ? "default" : "secondary"}>
                {state?.is_connected ? "Connected" : "Not connected"}
              </Badge>
              {state?.is_connected && state.connection_mode === "api_keys" && state.merchant_key_id && (
                <span className="text-xs text-muted-foreground">Key: {state.merchant_key_id}</span>
              )}
              {state?.is_connected && state.connection_mode === "oauth" && state.account_id && (
                <span className="text-xs text-muted-foreground">Account: {state.account_id}</span>
              )}
            </div>

            {!state?.is_connected && (
              <div className="space-y-4 rounded-md border p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Connect your Razorpay account</p>
                  <p className="text-xs text-muted-foreground">
                    Use API keys from Razorpay Dashboard → Account &amp; Settings → API Keys.
                    One connection applies to all outlets in your restaurant.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="razorpay-key-id">Key ID</Label>
                    <Input
                      id="razorpay-key-id"
                      placeholder="rzp_test_..."
                      value={keyId}
                      onChange={(e) => setKeyId(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="razorpay-key-secret">Key Secret</Label>
                    <Input
                      id="razorpay-key-secret"
                      type="password"
                      placeholder="Your Razorpay key secret"
                      value={keySecret}
                      onChange={(e) => setKeySecret(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  <Button
                    onClick={() => void handleApiKeyConnect()}
                    disabled={!state?.entitled || connecting || !keyId.trim() || !keySecret.trim()}
                    className="gradient-warm text-white border-0"
                  >
                    {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Connect Razorpay"}
                  </Button>
                </div>

                {state?.oauth_available && (
                  <>
                    <div className="relative py-1">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border/60" />
                      </div>
                      <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
                        <span className="bg-background px-3 text-muted-foreground">or</span>
                      </div>
                    </div>
                    <Button variant="outline" onClick={() => void handleConnect()} disabled={!state?.entitled}>
                      Connect via OAuth
                    </Button>
                  </>
                )}
              </div>
            )}

            {state?.oauth_available && !state?.is_connected && (
              <p className="text-xs text-muted-foreground">
                OAuth redirect URI:{" "}
                <code className="break-all">{state.oauth_callback_url}</code>
              </p>
            )}

            {state?.is_connected && (
              <Button variant="outline" onClick={handleDisconnect} disabled={disconnecting}>
                {disconnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Unplug className="h-4 w-4 mr-2" />
                )}
                Disconnect
              </Button>
            )}

            {!state?.entitled && (
              <p className="text-sm text-amber-700">
                Your current plan does not include payment integrations.
              </p>
            )}

            <div className="space-y-4 rounded-md border p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Enable online payments</Label>
                  <p className="text-xs text-muted-foreground">Show Online Payment at customer checkout.</p>
                </div>
                <Switch
                  checked={state?.settings.online_payments_enabled ?? false}
                  disabled={saving}
                  onCheckedChange={(v) => void saveSettings({ online_payments_enabled: v })}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Allow cash on delivery</Label>
                  <p className="text-xs text-muted-foreground">Keep COD as fallback payment option.</p>
                </div>
                <Switch
                  checked={state?.settings.allow_cod ?? true}
                  disabled={saving}
                  onCheckedChange={(v) => void saveSettings({ allow_cod: v })}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Allow partial refunds</Label>
                  <p className="text-xs text-muted-foreground">Allow operators to issue partial refunds.</p>
                </div>
                <Switch
                  checked={state?.settings.allow_partial_refunds ?? true}
                  disabled={saving}
                  onCheckedChange={(v) => void saveSettings({ allow_partial_refunds: v })}
                />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

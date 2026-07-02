import { useCallback, useEffect, useState } from "react";
import { useOutlet } from "@/lib/outlet-context";
import { useFeatureGating } from "@/hooks/use-feature-gating";
import { API_URL } from "@/lib/api-url";
import { supabase } from "@/integrations/supabase/client";
import { FeatureGate } from "@/components/FeatureGate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ShiprocketLogo } from "@/components/shiprocket/ShiprocketLogo";
import { Check, Copy, Loader2, Unplug } from "lucide-react";

interface PickupAddress {
  name?: string;
  phone?: string;
  address?: string;
  address_2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface ShiprocketSettings {
  auto_delivery_enabled: boolean;
  prep_time_minutes: number;
  default_weight_kg: number;
  dimensions: { length: number; width: number; height: number };
  pickup_address: PickupAddress;
  pickup_location_name: string;
  cod_enabled: boolean;
  retry_max_attempts: number;
  retry_interval_seconds: number;
}

interface ShiprocketState {
  is_connected: boolean;
  connected_at: string | null;
  settings: ShiprocketSettings;
  webhook_url: string;
  entitled: boolean;
}

const DEFAULT_SETTINGS: ShiprocketSettings = {
  auto_delivery_enabled: false,
  prep_time_minutes: 15,
  default_weight_kg: 0.5,
  dimensions: { length: 20, width: 20, height: 10 },
  pickup_address: {},
  pickup_location_name: "Primary",
  cod_enabled: true,
  retry_max_attempts: 3,
  retry_interval_seconds: 120,
};

export function ShiprocketSettingsPanel() {
  const { currentOutlet } = useOutlet();
  const { toast } = useToast();
  const { canAccess } = useFeatureGating();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [state, setState] = useState<ShiprocketState | null>(null);
  const [settings, setSettings] = useState<ShiprocketSettings>(DEFAULT_SETTINGS);
  const [outletGps, setOutletGps] = useState<{ lat: number | null; lng: number | null }>({
    lat: null,
    lng: null,
  });

  const outletId = currentOutlet?.id;

  const fetchOutletGps = useCallback(async () => {
    if (!outletId) return;
    const { data } = await supabase
      .from("outlets")
      .select("latitude, longitude")
      .eq("id", outletId)
      .maybeSingle();
    setOutletGps({
      lat: data?.latitude != null ? Number(data.latitude) : null,
      lng: data?.longitude != null ? Number(data.longitude) : null,
    });
  }, [outletId]);

  const fetchState = useCallback(async () => {
    if (!outletId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/outlets/${outletId}/shiprocket`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load Shiprocket settings");
      setState(json);
      setSettings({ ...DEFAULT_SETTINGS, ...json.settings });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load settings",
      });
    } finally {
      setLoading(false);
    }
  }, [outletId, toast]);

  useEffect(() => {
    void fetchState();
    void fetchOutletGps();
  }, [fetchState, fetchOutletGps]);

  const handleConnect = async () => {
    if (!outletId || !email.trim() || !password) return;
    setConnecting(true);
    try {
      const res = await fetch(`${API_URL}/api/outlets/${outletId}/shiprocket/connect`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Connection failed");
      setState(json);
      setSettings({ ...DEFAULT_SETTINGS, ...json.settings });
      setConnectOpen(false);
      setPassword("");
      toast({ title: "Connected", description: "Shiprocket account linked successfully." });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Connection failed",
        description: err instanceof Error ? err.message : "Could not connect",
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!outletId) return;
    setDisconnecting(true);
    try {
      const res = await fetch(`${API_URL}/api/outlets/${outletId}/shiprocket/disconnect`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Disconnect failed");
      }
      await fetchState();
      toast({ title: "Disconnected", description: "Shiprocket has been disconnected." });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Could not disconnect",
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!outletId) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/outlets/${outletId}/shiprocket/settings`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setState(json);
      setSettings({ ...DEFAULT_SETTINGS, ...json.settings });
      toast({ title: "Saved", description: "Delivery settings updated." });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Could not save settings",
      });
    } finally {
      setSaving(false);
    }
  };

  const copyWebhook = async () => {
    if (!state?.webhook_url) return;
    await navigator.clipboard.writeText(state.webhook_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied", description: "Webhook URL copied to clipboard." });
  };

  if (!outletId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Select an outlet to configure Shiprocket delivery.
        </CardContent>
      </Card>
    );
  }

  if (!canAccess("shiprocketDelivery")) {
    return (
      <FeatureGate feature="shiprocketDelivery">
        <div />
      </FeatureGate>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            <ShiprocketLogo variant="full" className="h-7" />
            <span className="text-base">Quick — Food Delivery</span>
          </CardTitle>
          <CardDescription>
            City-level hyperlocal delivery using Shiprocket Quick 2-wheeler riders only.
            National surface/air couriers are not used for restaurant food orders.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={state?.is_connected ? "default" : "secondary"}>
                  {state?.is_connected ? "Connected" : "Not connected"}
                </Badge>
                {state?.is_connected && state.connected_at && (
                  <span className="text-xs text-muted-foreground">
                    Since {new Date(state.connected_at).toLocaleDateString("en-IN")}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {!state?.is_connected ? (
                  <Button onClick={() => setConnectOpen(true)}>Connect Shiprocket</Button>
                ) : (
                  <Button variant="outline" onClick={handleDisconnect} disabled={disconnecting}>
                    {disconnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Unplug className="h-4 w-4 mr-2" />}
                    Disconnect
                  </Button>
                )}
              </div>

              {state?.webhook_url && (
                <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
                  <Label className="text-xs">Webhook URL (paste in Shiprocket panel)</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={state.webhook_url} className="text-xs font-mono" />
                    <Button type="button" variant="outline" size="icon" onClick={copyWebhook}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {!loading && (
        <Card>
          <CardHeader>
            <CardTitle>Quick delivery settings</CardTitle>
            <CardDescription>
              Food orders book as <strong>SR_QUICK</strong> hyperlocal shipments with GPS pickup and drop pins.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground space-y-1">
              <p>
                <strong className="text-foreground">Requirements:</strong> Outlet GPS on the map, customer delivery pin
                at checkout, and Shiprocket Quick enabled in your city.
              </p>
              <p>
                Outlet GPS:{" "}
                {outletGps.lat != null && outletGps.lng != null ? (
                  <span className="text-green-700 font-medium">Set ({outletGps.lat.toFixed(4)}, {outletGps.lng.toFixed(4)})</span>
                ) : (
                  <span className="text-amber-700 font-medium">Not set — open Outlets → outlet detail → set map location</span>
                )}
              </p>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>Auto-book Quick rider</Label>
                <p className="text-xs text-muted-foreground">
                  Book a 2-wheeler when order moves to preparing (after prep time).
                </p>
              </div>
              <Switch
                checked={settings.auto_delivery_enabled}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, auto_delivery_enabled: v }))}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Prep time (minutes)</Label>
                <Input
                  type="number"
                  min={0}
                  value={settings.prep_time_minutes}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, prep_time_minutes: Number(e.target.value) || 0 }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Food package weight (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min={0.5}
                  max={5}
                  value={settings.default_weight_kg}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      default_weight_kg: Math.min(5, Math.max(0.5, Number(e.target.value) || 0.5)),
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">Max 5 kg for Quick 2-wheeler food bags.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Food package size (cm)</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["length", "width", "height"] as const).map((dim) => (
                  <Input
                    key={dim}
                    type="number"
                    placeholder={dim}
                    value={settings.dimensions[dim]}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        dimensions: { ...s.dimensions, [dim]: Number(e.target.value) || 0 },
                      }))
                    }
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Pickup location name</Label>
              <Input
                value={settings.pickup_location_name}
                onChange={(e) => setSettings((s) => ({ ...s, pickup_location_name: e.target.value }))}
                placeholder="Primary"
              />
            </div>

            <div className="space-y-3">
              <Label>Pickup address</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  placeholder="Contact name"
                  value={settings.pickup_address.name ?? ""}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      pickup_address: { ...s.pickup_address, name: e.target.value },
                    }))
                  }
                />
                <Input
                  placeholder="Phone"
                  value={settings.pickup_address.phone ?? currentOutlet?.phone ?? ""}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      pickup_address: { ...s.pickup_address, phone: e.target.value },
                    }))
                  }
                />
                <Input
                  className="sm:col-span-2"
                  placeholder="Address line 1"
                  value={settings.pickup_address.address ?? currentOutlet?.address ?? ""}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      pickup_address: { ...s.pickup_address, address: e.target.value },
                    }))
                  }
                />
                <Input
                  className="sm:col-span-2"
                  placeholder="Address line 2"
                  value={settings.pickup_address.address_2 ?? ""}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      pickup_address: { ...s.pickup_address, address_2: e.target.value },
                    }))
                  }
                />
                <Input
                  placeholder="City"
                  value={settings.pickup_address.city ?? ""}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      pickup_address: { ...s.pickup_address, city: e.target.value },
                    }))
                  }
                />
                <Input
                  placeholder="State"
                  value={settings.pickup_address.state ?? ""}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      pickup_address: { ...s.pickup_address, state: e.target.value },
                    }))
                  }
                />
                <Input
                  placeholder="Pincode"
                  value={settings.pickup_address.pincode ?? ""}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      pickup_address: { ...s.pickup_address, pincode: e.target.value },
                    }))
                  }
                />
                <div className="sm:col-span-2 flex flex-wrap items-end gap-2">
                  <div className="flex-1 min-w-[120px] space-y-1">
                    <Label className="text-xs">Pickup latitude</Label>
                    <Input
                      type="number"
                      step="any"
                      placeholder={outletGps.lat != null ? String(outletGps.lat) : "From outlet map"}
                      value={settings.pickup_address.latitude ?? ""}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          pickup_address: {
                            ...s.pickup_address,
                            latitude: e.target.value === "" ? null : Number(e.target.value),
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="flex-1 min-w-[120px] space-y-1">
                    <Label className="text-xs">Pickup longitude</Label>
                    <Input
                      type="number"
                      step="any"
                      placeholder={outletGps.lng != null ? String(outletGps.lng) : "From outlet map"}
                      value={settings.pickup_address.longitude ?? ""}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          pickup_address: {
                            ...s.pickup_address,
                            longitude: e.target.value === "" ? null : Number(e.target.value),
                          },
                        }))
                      }
                    />
                  </div>
                  {outletGps.lat != null && outletGps.lng != null && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setSettings((s) => ({
                          ...s,
                          pickup_address: {
                            ...s.pickup_address,
                            latitude: outletGps.lat,
                            longitude: outletGps.lng,
                          },
                        }))
                      }
                    >
                      Use outlet GPS
                    </Button>
                  )}
                </div>
                <Input
                  placeholder="Country"
                  value={settings.pickup_address.country ?? "India"}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      pickup_address: { ...s.pickup_address, country: e.target.value },
                    }))
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>Allow COD shipments</Label>
                <p className="text-xs text-muted-foreground">Use COD payment method for cash orders.</p>
              </div>
              <Switch
                checked={settings.cod_enabled}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, cod_enabled: v }))}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Max retry attempts</Label>
                <Input
                  type="number"
                  min={0}
                  value={settings.retry_max_attempts}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, retry_max_attempts: Number(e.target.value) || 0 }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Retry interval (seconds)</Label>
                <Input
                  type="number"
                  min={30}
                  value={settings.retry_interval_seconds}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      retry_interval_seconds: Number(e.target.value) || 120,
                    }))
                  }
                />
              </div>
            </div>

            <Button onClick={handleSaveSettings} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save settings
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex justify-center pb-2">
              <ShiprocketLogo variant="full" className="h-8" />
            </div>
            <DialogTitle>Connect Shiprocket</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Use your <strong className="text-foreground">Shiprocket API user</strong> credentials —
                  not your main Shiprocket panel login.
                </p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Log in to app.shiprocket.in</li>
                  <li>Go to Settings → API → Create API user</li>
                  <li>Use a new email (different from your registered email)</li>
                  <li>Set the API password and enter those credentials below</li>
                </ol>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>API user email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="api-user@example.com"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label>API user password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConnect} disabled={connecting || !email.trim() || !password}>
              {connecting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

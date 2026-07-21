import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Loader2, RefreshCw, Save, Truck, Unplug } from "lucide-react";
import { API_URL } from "@/lib/api-url";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PickupAddress {
  name?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

interface ShiprocketSettings {
  auto_delivery_enabled: boolean;
  prep_time_minutes: number;
  default_weight_kg: number;
  pickup_address: PickupAddress;
  pickup_location_name: string;
  cod_enabled: boolean;
  webhook_secret: string | null;
}

interface DeliveryRow {
  outlet: { id: string; name: string; is_active: boolean };
  shiprocket: {
    is_connected: boolean;
    connected_at: string | null;
    webhook_url: string;
    settings: ShiprocketSettings;
  };
}

interface Props {
  userId: string;
}

export function CmsCustomerDeliveryPanel({ userId }: Props) {
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [connectOpen, setConnectOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [copied, setCopied] = useState<"url" | "secret" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/cms/customers/${userId}/delivery`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load delivery settings");
      const list: DeliveryRow[] = data.deliveries || [];
      setRows(list);
      setSelectedId((prev) => prev || list[0]?.outlet.id || "");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load delivery");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = rows.find((r) => r.outlet.id === selectedId) || null;

  const updateCurrentSettings = (patch: Partial<ShiprocketSettings>) => {
    setRows((prev) =>
      prev.map((row) =>
        row.outlet.id === selectedId
          ? {
              ...row,
              shiprocket: {
                ...row.shiprocket,
                settings: { ...row.shiprocket.settings, ...patch },
              },
            }
          : row
      )
    );
  };

  const generateWebhookSecret = () => {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    updateCurrentSettings({
      webhook_secret: Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""),
    });
  };

  const copyValue = async (value: string, type: "url" | "secret") => {
    await navigator.clipboard.writeText(value);
    setCopied(type);
    window.setTimeout(() => setCopied(null), 1500);
    toast.success(type === "url" ? "Webhook URL copied" : "Webhook secret copied");
  };

  const patchSettings = async (outletId: string, patch: Partial<ShiprocketSettings>) => {
    setSavingId(outletId);
    try {
      const res = await fetch(
        `${API_URL}/api/cms/customers/${userId}/outlets/${outletId}/shiprocket`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(patch),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setRows((prev) =>
        prev.map((r) =>
          r.outlet.id === outletId
            ? { outlet: data.outlet || r.outlet, shiprocket: data.shiprocket }
            : r
        )
      );
      toast.success("Delivery settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save delivery settings");
    } finally {
      setSavingId(null);
    }
  };

  const connect = async () => {
    if (!selectedId || !email.trim() || !password) return;
    setConnecting(true);
    try {
      const res = await fetch(
        `${API_URL}/api/cms/customers/${userId}/outlets/${selectedId}/shiprocket/connect`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email: email.trim(), password }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Connection failed");
      setRows((prev) =>
        prev.map((r) =>
          r.outlet.id === selectedId
            ? { outlet: data.outlet || r.outlet, shiprocket: data.shiprocket }
            : r
        )
      );
      setConnectOpen(false);
      setPassword("");
      toast.success("Shiprocket connected");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async (outletId: string) => {
    setSavingId(outletId);
    try {
      const res = await fetch(
        `${API_URL}/api/cms/customers/${userId}/outlets/${outletId}/shiprocket/disconnect`,
        { method: "POST", credentials: "include" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Disconnect failed");
      setRows((prev) =>
        prev.map((r) =>
          r.outlet.id === outletId
            ? { outlet: data.outlet || r.outlet, shiprocket: data.shiprocket }
            : r
        )
      );
      toast.success("Shiprocket disconnected");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Delivery</CardTitle>
          <CardDescription>Shiprocket delivery controls per outlet</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Create an outlet first to configure delivery.</p>
        </CardContent>
      </Card>
    );
  }

  const settings = current?.shiprocket.settings;
  const busy = savingId === selectedId;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Delivery
          </CardTitle>
          <CardDescription>Shiprocket connection and auto-delivery controls by outlet</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2 max-w-sm">
            <Label>Outlet</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rows.map((r) => (
                  <SelectItem key={r.outlet.id} value={r.outlet.id}>
                    {r.outlet.name}
                    {r.outlet.is_active ? " (active)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {current && settings && (
            <div className="space-y-5 border rounded-lg p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge variant={current.shiprocket.is_connected ? "default" : "secondary"}>
                    {current.shiprocket.is_connected ? "Connected" : "Not connected"}
                  </Badge>
                  {current.shiprocket.connected_at && (
                    <span className="text-xs text-muted-foreground">
                      since {new Date(current.shiprocket.connected_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {current.shiprocket.is_connected ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void disconnect(selectedId)}
                    >
                      <Unplug className="h-4 w-4 mr-1" />
                      Disconnect
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => setConnectOpen(true)}>
                      Connect Shiprocket
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                <div>
                  <p className="text-sm font-medium">Webhook connection</p>
                  <p className="text-xs text-muted-foreground">
                    Add this callback in Shiprocket to receive delivery status updates for this outlet.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Webhook URL</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={current.shiprocket.webhook_url || ""}
                      className="font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={!current.shiprocket.webhook_url}
                      onClick={() => void copyValue(current.shiprocket.webhook_url, "url")}
                    >
                      {copied === "url" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Webhook secret (header: x-api-key)</Label>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      readOnly
                      value={settings.webhook_secret || ""}
                      placeholder="Generate a secret to verify callbacks"
                      className="min-w-64 flex-1 font-mono text-xs"
                    />
                    <Button type="button" variant="outline" onClick={generateWebhookSecret}>
                      <RefreshCw className="mr-1 h-4 w-4" />
                      {settings.webhook_secret ? "Regenerate" : "Generate"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={!settings.webhook_secret}
                      onClick={() => void copyValue(settings.webhook_secret || "", "secret")}
                    >
                      {copied === "secret" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void patchSettings(selectedId, {
                          webhook_secret: settings.webhook_secret,
                        })
                      }
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save webhook"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Configure the same value in Shiprocket as the webhook API key.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">Auto delivery</p>
                    <p className="text-xs text-muted-foreground">Book Shiprocket when orders are ready</p>
                  </div>
                  <Switch
                    checked={!!settings.auto_delivery_enabled}
                    disabled={busy}
                    onCheckedChange={(v) => void patchSettings(selectedId, { auto_delivery_enabled: v })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">Cash on delivery</p>
                    <p className="text-xs text-muted-foreground">Allow COD for Shiprocket bookings</p>
                  </div>
                  <Switch
                    checked={settings.cod_enabled !== false}
                    disabled={busy}
                    onCheckedChange={(v) => void patchSettings(selectedId, { cod_enabled: v })}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Prep time (minutes)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={settings.prep_time_minutes}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) =>
                          r.outlet.id === selectedId
                            ? {
                                ...r,
                                shiprocket: {
                                  ...r.shiprocket,
                                  settings: {
                                    ...r.shiprocket.settings,
                                    prep_time_minutes: Number(e.target.value) || 0,
                                  },
                                },
                              }
                            : r
                        )
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default weight (kg)</Label>
                  <Input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={settings.default_weight_kg}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) =>
                          r.outlet.id === selectedId
                            ? {
                                ...r,
                                shiprocket: {
                                  ...r.shiprocket,
                                  settings: {
                                    ...r.shiprocket.settings,
                                    default_weight_kg: Number(e.target.value) || 0.5,
                                  },
                                },
                              }
                            : r
                        )
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pickup location name</Label>
                  <Input
                    value={settings.pickup_location_name || ""}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) =>
                          r.outlet.id === selectedId
                            ? {
                                ...r,
                                shiprocket: {
                                  ...r.shiprocket,
                                  settings: {
                                    ...r.shiprocket.settings,
                                    pickup_location_name: e.target.value,
                                  },
                                },
                              }
                            : r
                        )
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pickup pincode</Label>
                  <Input
                    value={settings.pickup_address?.pincode || ""}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) =>
                          r.outlet.id === selectedId
                            ? {
                                ...r,
                                shiprocket: {
                                  ...r.shiprocket,
                                  settings: {
                                    ...r.shiprocket.settings,
                                    pickup_address: {
                                      ...r.shiprocket.settings.pickup_address,
                                      pincode: e.target.value,
                                    },
                                  },
                                },
                              }
                            : r
                        )
                      )
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Pickup address</Label>
                  <Input
                    value={settings.pickup_address?.address || ""}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) =>
                          r.outlet.id === selectedId
                            ? {
                                ...r,
                                shiprocket: {
                                  ...r.shiprocket,
                                  settings: {
                                    ...r.shiprocket.settings,
                                    pickup_address: {
                                      ...r.shiprocket.settings.pickup_address,
                                      address: e.target.value,
                                    },
                                  },
                                },
                              }
                            : r
                        )
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    value={settings.pickup_address?.city || ""}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) =>
                          r.outlet.id === selectedId
                            ? {
                                ...r,
                                shiprocket: {
                                  ...r.shiprocket,
                                  settings: {
                                    ...r.shiprocket.settings,
                                    pickup_address: {
                                      ...r.shiprocket.settings.pickup_address,
                                      city: e.target.value,
                                    },
                                  },
                                },
                              }
                            : r
                        )
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input
                    value={settings.pickup_address?.state || ""}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) =>
                          r.outlet.id === selectedId
                            ? {
                                ...r,
                                shiprocket: {
                                  ...r.shiprocket,
                                  settings: {
                                    ...r.shiprocket.settings,
                                    pickup_address: {
                                      ...r.shiprocket.settings.pickup_address,
                                      state: e.target.value,
                                    },
                                  },
                                },
                              }
                            : r
                        )
                      )
                    }
                  />
                </div>
              </div>

              <Button
                disabled={busy}
                onClick={() =>
                  void patchSettings(selectedId, {
                    prep_time_minutes: settings.prep_time_minutes,
                    default_weight_kg: settings.default_weight_kg,
                    pickup_location_name: settings.pickup_location_name,
                    pickup_address: settings.pickup_address,
                  })
                }
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Save delivery details
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect Shiprocket</DialogTitle>
            <DialogDescription>
              Use the customer&apos;s Shiprocket API user email and password for this outlet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>API email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>API password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectOpen(false)} disabled={connecting}>
              Cancel
            </Button>
            <Button onClick={() => void connect()} disabled={connecting || !email.trim() || !password}>
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Connect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

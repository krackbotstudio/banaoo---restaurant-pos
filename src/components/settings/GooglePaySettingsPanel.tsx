import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Save, Unplug } from "lucide-react";
import { API_URL } from "@/lib/api-url";
import { useFeatureGating } from "@/hooks/use-feature-gating";
import { FeatureGate } from "@/components/FeatureGate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface GooglePayState {
  entitled: boolean;
  online_payment_provider: "razorpay" | "google_pay" | null;
  ready: boolean;
  google_pay: {
    is_configured: boolean;
    is_enabled: boolean;
    merchant_vpa: string | null;
    payee_name: string | null;
    mcc: string | null;
    connected_at: string | null;
    settings: { allow_cod: boolean };
  };
}

export function GooglePaySettingsPanel() {
  const { canAccess } = useFeatureGating();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<GooglePayState | null>(null);
  const [vpa, setVpa] = useState("");
  const [payeeName, setPayeeName] = useState("");
  const [mcc, setMcc] = useState("5812");
  const [enabled, setEnabled] = useState(false);
  const [allowCod, setAllowCod] = useState(true);
  const [provider, setProvider] = useState<"razorpay" | "google_pay" | "none">("none");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/google-pay`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load Google Pay settings");
      setState(json);
      setVpa(json.google_pay?.merchant_vpa || "");
      setPayeeName(json.google_pay?.payee_name || "");
      setMcc(json.google_pay?.mcc || "5812");
      setEnabled(!!json.google_pay?.is_enabled);
      setAllowCod(json.google_pay?.settings?.allow_cod !== false);
      setProvider(json.online_payment_provider || "none");
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load Google Pay",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/google-pay`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant_vpa: vpa.trim(),
          payee_name: payeeName.trim(),
          mcc: mcc.trim(),
          is_enabled: enabled,
          allow_cod: allowCod,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");
      setState(json);
      setProvider(json.online_payment_provider || "none");
      toast({ title: "Saved", description: "Google Pay settings updated." });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save",
      });
    } finally {
      setSaving(false);
    }
  };

  const changeProvider = async (next: "razorpay" | "google_pay" | "none") => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/online-payment-provider`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: next === "none" ? null : next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update provider");
      setProvider(json.online_payment_provider || "none");
      toast({
        title: "Provider updated",
        description:
          next === "none"
            ? "No online payment provider selected."
            : `Checkout will use ${next === "google_pay" ? "Google Pay" : "Razorpay"}.`,
      });
      await load();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update provider",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!canAccess("googlePayIndia")) {
    return (
      <FeatureGate feature="googlePayIndia">
        <Card>
          <CardHeader>
            <CardTitle>Google Pay India</CardTitle>
            <CardDescription>
              Activate the free Google Pay India add-on to accept UPI payments on your ordering link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link to="/addons">Open Add-ons</Link>
            </Button>
          </CardContent>
        </Card>
      </FeatureGate>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">Google Pay India</CardTitle>
        <CardDescription>
          Direct UPI to your merchant VPA via Google Pay. Customers submit a UTR; your team confirms
          payment before fulfilling the order.
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
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={state?.ready ? "default" : "secondary"}>
                {state?.ready ? "Ready" : "Not ready"}
              </Badge>
              <Badge variant="outline">
                Active provider:{" "}
                {provider === "google_pay"
                  ? "Google Pay"
                  : provider === "razorpay"
                    ? "Razorpay"
                    : "None"}
              </Badge>
            </div>

            <div className="space-y-2 max-w-sm">
              <Label>Online payment provider</Label>
              <Select
                value={provider}
                onValueChange={(v) => void changeProvider(v as "razorpay" | "google_pay" | "none")}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (COD only)</SelectItem>
                  <SelectItem value="razorpay">Razorpay</SelectItem>
                  <SelectItem value="google_pay">Google Pay India</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Only one provider is shown at customer checkout. Configure Google Pay below before
                selecting it.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="gpay-vpa">Merchant VPA *</Label>
                <Input
                  id="gpay-vpa"
                  className="font-mono"
                  placeholder="yourshop@okaxis"
                  value={vpa}
                  onChange={(e) => setVpa(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gpay-payee">Payee name *</Label>
                <Input
                  id="gpay-payee"
                  placeholder="Restaurant display name"
                  value={payeeName}
                  onChange={(e) => setPayeeName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gpay-mcc">MCC (4 digits) *</Label>
                <Input
                  id="gpay-mcc"
                  className="font-mono"
                  placeholder="5812"
                  value={mcc}
                  onChange={(e) => setMcc(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Restaurants typically use 5812.</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Enable Google Pay</p>
                  <p className="text-xs text-muted-foreground">Requires valid VPA, name, and MCC</p>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} disabled={saving} />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Allow COD</p>
                  <p className="text-xs text-muted-foreground">Cash on delivery alongside Google Pay</p>
                </div>
                <Switch checked={allowCod} onCheckedChange={setAllowCod} disabled={saving} />
              </div>
            </div>

            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-muted-foreground">
              Google Pay India settles to your VPA. After the customer pays, they must enter the UTR /
              UPI reference so your team can confirm the payment.
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void saveConfig()} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Save Google Pay
              </Button>
              {enabled && (
                <Button
                  variant="outline"
                  disabled={saving}
                  onClick={() => {
                    setEnabled(false);
                    void (async () => {
                      setSaving(true);
                      try {
                        const res = await fetch(`${API_URL}/api/google-pay`, {
                          method: "PUT",
                          credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            merchant_vpa: vpa.trim(),
                            payee_name: payeeName.trim(),
                            mcc: mcc.trim(),
                            is_enabled: false,
                            allow_cod: allowCod,
                          }),
                        });
                        const json = await res.json();
                        if (!res.ok) throw new Error(json.error || "Failed to disable");
                        setState(json);
                        toast({ title: "Disabled", description: "Google Pay disabled." });
                      } catch (err) {
                        toast({
                          variant: "destructive",
                          title: "Error",
                          description: err instanceof Error ? err.message : "Failed",
                        });
                      } finally {
                        setSaving(false);
                      }
                    })();
                  }}
                >
                  <Unplug className="h-4 w-4 mr-1" />
                  Disable
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

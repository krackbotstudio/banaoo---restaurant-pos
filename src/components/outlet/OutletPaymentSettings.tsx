import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, IndianRupee } from "lucide-react";
import { isValidUpiVpa } from "@/lib/upi";
import { UpiQrUpload } from "@/components/payments/UpiQrUpload";

interface OutletPaymentSettingsProps {
  outletId: string;
  outletName: string;
}

export function OutletPaymentSettings({ outletId, outletName }: OutletPaymentSettingsProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [upiVpa, setUpiVpa] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [onlineEnabled, setOnlineEnabled] = useState(true);
  const [useOutletOverride, setUseOutletOverride] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("outlets")
        .select("upi_vpa, upi_display_name, upi_qr_url, online_payments_enabled")
        .eq("id", outletId)
        .single();
      if (data) {
        const hasOverride = !!(data.upi_vpa || data.upi_display_name || data.upi_qr_url || data.online_payments_enabled != null);
        setUseOutletOverride(hasOverride);
        setUpiVpa(data.upi_vpa ?? "");
        setDisplayName(data.upi_display_name ?? "");
        setQrUrl(data.upi_qr_url ?? "");
        setOnlineEnabled(data.online_payments_enabled ?? true);
      }
      setLoading(false);
    })();
  }, [outletId]);

  const handleSave = async () => {
    if (useOutletOverride && upiVpa.trim() && !isValidUpiVpa(upiVpa)) {
      toast({ variant: "destructive", title: "Invalid UPI ID", description: "Use format name@bank" });
      return;
    }
    setSaving(true);
    const payload = useOutletOverride
      ? {
          upi_vpa: upiVpa.trim() || null,
          upi_display_name: displayName.trim() || null,
          upi_qr_url: qrUrl.trim() || null,
          online_payments_enabled: onlineEnabled,
        }
      : {
          upi_vpa: null,
          upi_display_name: null,
          upi_qr_url: null,
          online_payments_enabled: null,
        };

    const { error } = await supabase.from("outlets").update(payload).eq("id", outletId);
    setSaving(false);
    if (error) {
      toast({ variant: "destructive", title: "Save failed", description: error.message });
    } else {
      toast({ title: "Payment settings saved" });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const accountVpa = profile?.upi_vpa;
  const accountName = profile?.upi_display_name || profile?.brand_name;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <IndianRupee className="h-4 w-4" />
          Customer UPI payments
        </CardTitle>
        <CardDescription>
          Customers pay via UPI (not Razorpay). Configure your VPA and optional static QR for {outletName}.
          Leave blank to use account defaults from Settings → Branding.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!useOutletOverride && (accountVpa || accountName) && (
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p className="text-muted-foreground text-xs mb-1">Using account default</p>
            <p className="font-medium">{accountName || "—"}</p>
            <p className="font-mono text-xs">{accountVpa || "No UPI ID on account"}</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <Label htmlFor="outlet-upi-override">Outlet-specific UPI settings</Label>
          <Switch
            id="outlet-upi-override"
            checked={useOutletOverride}
            onCheckedChange={setUseOutletOverride}
          />
        </div>

        {useOutletOverride && (
          <>
            <div className="flex items-center justify-between">
              <Label>Accept online UPI orders</Label>
              <Switch checked={onlineEnabled} onCheckedChange={setOnlineEnabled} />
            </div>
            <div className="space-y-2">
              <Label>UPI ID (VPA) *</Label>
              <Input
                placeholder="yourname@paytm"
                value={upiVpa}
                onChange={(e) => setUpiVpa(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Display name on UPI apps</Label>
              <Input
                placeholder={outletName}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <UpiQrUpload value={qrUrl} onChange={setQrUrl} />
          </>
        )}

        <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save payment settings
        </Button>
      </CardContent>
    </Card>
  );
}

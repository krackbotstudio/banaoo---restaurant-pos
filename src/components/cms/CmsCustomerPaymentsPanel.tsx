import { useCallback, useEffect, useState } from "react";
import { CreditCard, Loader2, Save, Unplug } from "lucide-react";
import { API_URL } from "@/lib/api-url";
import { resolveImageUrl } from "@/lib/image-url";
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

export interface ProfilePaymentState {
  upi_vpa?: string | null;
  upi_display_name?: string | null;
  upi_qr_url?: string | null;
  online_payments_enabled?: boolean | null;
}

interface RazorpayState {
  is_connected: boolean;
  connection_mode: string | null;
  connected_at: string | null;
  account_id: string | null;
  account_name: string | null;
  merchant_key_id: string | null;
  settings: {
    online_payments_enabled: boolean;
    allow_cod: boolean;
    allow_partial_refunds: boolean;
  };
}

interface Props {
  userId: string;
  payments: ProfilePaymentState;
  onSaved: () => void;
}

export function CmsCustomerPaymentsPanel({ userId, payments, onSaved }: Props) {
  const [upiForm, setUpiForm] = useState({
    upi_vpa: payments.upi_vpa || "",
    upi_display_name: payments.upi_display_name || "",
    upi_qr_url: payments.upi_qr_url || "",
    online_payments_enabled: payments.online_payments_enabled !== false,
  });
  const [savingUpi, setSavingUpi] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);
  const [razorpay, setRazorpay] = useState<RazorpayState | null>(null);
  const [loadingRz, setLoadingRz] = useState(true);
  const [savingRz, setSavingRz] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    setUpiForm({
      upi_vpa: payments.upi_vpa || "",
      upi_display_name: payments.upi_display_name || "",
      upi_qr_url: payments.upi_qr_url || "",
      online_payments_enabled: payments.online_payments_enabled !== false,
    });
  }, [payments]);

  const loadRazorpay = useCallback(async () => {
    setLoadingRz(true);
    try {
      const res = await fetch(`${API_URL}/api/cms/customers/${userId}/razorpay`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load Razorpay");
      setRazorpay(data.razorpay);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load Razorpay");
      setRazorpay(null);
    } finally {
      setLoadingRz(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadRazorpay();
  }, [loadRazorpay]);

  const saveUpi = async () => {
    setSavingUpi(true);
    try {
      const res = await fetch(`${API_URL}/api/cms/customers/${userId}/payment-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          upi_vpa: upiForm.upi_vpa.trim() || null,
          upi_display_name: upiForm.upi_display_name.trim() || null,
          upi_qr_url: upiForm.upi_qr_url || null,
          online_payments_enabled: upiForm.online_payments_enabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save payment settings");
      toast.success("UPI payment settings saved");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingUpi(false);
    }
  };

  const uploadQr = async (file: File) => {
    setUploadingQr(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        credentials: "include",
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setUpiForm((s) => ({ ...s, upi_qr_url: data.url }));
      toast.success("QR uploaded — click Save UPI settings to apply");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingQr(false);
    }
  };

  const patchRazorpaySettings = async (patch: Partial<RazorpayState["settings"]>) => {
    if (!razorpay) return;
    setSavingRz(true);
    try {
      const res = await fetch(`${API_URL}/api/cms/customers/${userId}/razorpay/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...razorpay.settings, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save Razorpay settings");
      setRazorpay(data.razorpay);
      toast.success("Razorpay settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingRz(false);
    }
  };

  const connectRazorpay = async () => {
    setConnecting(true);
    try {
      const res = await fetch(`${API_URL}/api/cms/customers/${userId}/razorpay/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ key_id: keyId.trim(), key_secret: keySecret.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Connection failed");
      setRazorpay(data.razorpay);
      setConnectOpen(false);
      setKeySecret("");
      toast.success("Razorpay connected");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  };

  const disconnectRazorpay = async () => {
    setSavingRz(true);
    try {
      const res = await fetch(`${API_URL}/api/cms/customers/${userId}/razorpay/disconnect`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Disconnect failed");
      setRazorpay(data.razorpay);
      toast.success("Razorpay disconnected");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setSavingRz(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Customer UPI payments
          </CardTitle>
          <CardDescription>
            Default UPI settings for online orders across this customer&apos;s outlets
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Enable UPI for online orders</p>
              <p className="text-xs text-muted-foreground">Profile-level default for customer checkout</p>
            </div>
            <Switch
              checked={upiForm.online_payments_enabled}
              onCheckedChange={(v) => setUpiForm((s) => ({ ...s, online_payments_enabled: v }))}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>UPI ID (VPA)</Label>
              <Input
                className="font-mono"
                placeholder="name@upi"
                value={upiForm.upi_vpa}
                onChange={(e) => setUpiForm((s) => ({ ...s, upi_vpa: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Display name</Label>
              <Input
                value={upiForm.upi_display_name}
                onChange={(e) => setUpiForm((s) => ({ ...s, upi_display_name: e.target.value }))}
                placeholder="Restaurant name on UPI apps"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>UPI QR image</Label>
            <div className="flex items-center gap-4">
              {upiForm.upi_qr_url ? (
                <img
                  src={resolveImageUrl(upiForm.upi_qr_url)}
                  alt="UPI QR"
                  className="h-20 w-20 rounded border object-contain bg-white"
                />
              ) : (
                <div className="h-20 w-20 rounded border border-dashed text-xs text-muted-foreground flex items-center justify-center">
                  No QR
                </div>
              )}
              <div className="space-y-2">
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm cursor-pointer hover:bg-accent">
                  {uploadingQr ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upload QR"}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={uploadingQr}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadQr(file);
                      e.target.value = "";
                    }}
                  />
                </label>
                {upiForm.upi_qr_url && (
                  <button
                    type="button"
                    className="block text-xs text-destructive hover:underline"
                    onClick={() => setUpiForm((s) => ({ ...s, upi_qr_url: "" }))}
                  >
                    Remove QR
                  </button>
                )}
              </div>
            </div>
          </div>
          <Button onClick={() => void saveUpi()} disabled={savingUpi || uploadingQr}>
            {savingUpi ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Save UPI settings
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Razorpay</CardTitle>
          <CardDescription>Online payment gateway connection and checkout toggles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingRz ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : razorpay ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={razorpay.is_connected ? "default" : "secondary"}>
                      {razorpay.is_connected ? "Connected" : "Not connected"}
                    </Badge>
                    {razorpay.connection_mode && (
                      <Badge variant="outline">{razorpay.connection_mode}</Badge>
                    )}
                  </div>
                  {(razorpay.account_name || razorpay.merchant_key_id || razorpay.account_id) && (
                    <p className="text-xs text-muted-foreground font-mono">
                      {razorpay.account_name || razorpay.merchant_key_id || razorpay.account_id}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {razorpay.is_connected ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={savingRz}
                      onClick={() => void disconnectRazorpay()}
                    >
                      <Unplug className="h-4 w-4 mr-1" />
                      Disconnect
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => setConnectOpen(true)}>
                      Connect with API keys
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex items-center justify-between rounded-md border p-3">
                  <p className="text-sm">Online payments</p>
                  <Switch
                    checked={razorpay.settings.online_payments_enabled}
                    disabled={savingRz}
                    onCheckedChange={(v) => void patchRazorpaySettings({ online_payments_enabled: v })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <p className="text-sm">Allow COD</p>
                  <Switch
                    checked={razorpay.settings.allow_cod}
                    disabled={savingRz}
                    onCheckedChange={(v) => void patchRazorpaySettings({ allow_cod: v })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <p className="text-sm">Partial refunds</p>
                  <Switch
                    checked={razorpay.settings.allow_partial_refunds}
                    disabled={savingRz}
                    onCheckedChange={(v) => void patchRazorpaySettings({ allow_partial_refunds: v })}
                  />
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Could not load Razorpay status.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect Razorpay</DialogTitle>
            <DialogDescription>
              Paste the customer&apos;s Razorpay Key ID and Key Secret (API keys mode).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Key ID</Label>
              <Input
                className="font-mono"
                value={keyId}
                onChange={(e) => setKeyId(e.target.value)}
                placeholder="rzp_live_..."
              />
            </div>
            <div className="space-y-2">
              <Label>Key Secret</Label>
              <Input
                type="password"
                className="font-mono"
                value={keySecret}
                onChange={(e) => setKeySecret(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectOpen(false)} disabled={connecting}>
              Cancel
            </Button>
            <Button
              onClick={() => void connectRazorpay()}
              disabled={connecting || !keyId.trim() || !keySecret.trim()}
            >
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Connect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

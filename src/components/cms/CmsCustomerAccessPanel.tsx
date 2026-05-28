import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2, Save, Sparkles, Shield } from "lucide-react";
import { API_URL } from "@/lib/api-url";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CmsFeatureToggles } from "@/components/cms/CmsFeatureToggles";
import type { FeatureOverrides } from "@/lib/cms-features";

type PlanType = "starter" | "professional" | "enterprise";

export interface CustomerAccessState {
  is_test_account: boolean;
  billing_exempt: boolean;
  complimentary_plan: PlanType | null;
  complimentary_expires_at: string | null;
  is_active: boolean;
  effective_plan: PlanType | null;
  feature_summary: string[];
  feature_overrides?: FeatureOverrides;
}

interface Props {
  userId: string;
  access: CustomerAccessState;
  onSaved: () => void;
}

function toDateInputValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function CmsCustomerAccessPanel({ userId, access, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [isTestAccount, setIsTestAccount] = useState(access.is_test_account);
  const [billingExempt, setBillingExempt] = useState(access.billing_exempt);
  const [plan, setPlan] = useState<PlanType>(access.complimentary_plan || "professional");
  const [expiresAt, setExpiresAt] = useState(toDateInputValue(access.complimentary_expires_at));
  const [featureOverrides, setFeatureOverrides] = useState<FeatureOverrides>(
    access.feature_overrides ?? {}
  );

  useEffect(() => {
    setIsTestAccount(access.is_test_account);
    setBillingExempt(access.billing_exempt);
    setPlan(access.complimentary_plan || "professional");
    setExpiresAt(toDateInputValue(access.complimentary_expires_at));
    setFeatureOverrides(access.feature_overrides ?? {});
  }, [access]);

  const saveAccess = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/cms/customers/${userId}/access`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          is_test_account: isTestAccount,
          billing_exempt: isTestAccount ? true : billingExempt,
          complimentary_plan: isTestAccount ? "enterprise" : plan,
          complimentary_expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
          feature_overrides: featureOverrides,
          sync_subscription: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update access");
      toast.success("Access settings saved");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save access");
    } finally {
      setSaving(false);
    }
  };

  const revokeAccess = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/cms/customers/${userId}/access`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          is_test_account: false,
          billing_exempt: false,
          complimentary_plan: null,
          complimentary_expires_at: null,
          sync_subscription: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to revoke access");
      toast.success("Complimentary access removed");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke access");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Access & billing
            </CardTitle>
            <CardDescription>
              Grant subscription and module access without Razorpay payment. Test accounts get full
              Enterprise features.
            </CardDescription>
          </div>
          {access.is_active && (
            <Badge variant="default" className="shrink-0">
              Active · {access.effective_plan}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
          <div className="space-y-1">
            <Label htmlFor="test-account" className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Test account
            </Label>
            <p className="text-sm text-muted-foreground">
              Full access to all modules and pages (Enterprise) with no payment required.
            </p>
          </div>
          <Switch
            id="test-account"
            checked={isTestAccount}
            onCheckedChange={(v) => {
              setIsTestAccount(v);
              if (v) {
                setBillingExempt(true);
                setPlan("enterprise");
              }
            }}
          />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
          <div className="space-y-1">
            <Label htmlFor="billing-exempt" className="text-base">
              Complimentary subscription
            </Label>
            <p className="text-sm text-muted-foreground">
              Enable an active plan without collecting payment (starter, professional, or
              enterprise).
            </p>
          </div>
          <Switch
            id="billing-exempt"
            checked={billingExempt || isTestAccount}
            disabled={isTestAccount}
            onCheckedChange={setBillingExempt}
          />
        </div>

        {!isTestAccount && (billingExempt || access.is_active) && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Plan tier</Label>
              <Select value={plan} onValueChange={(v) => setPlan(v as PlanType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Access expires (optional)</Label>
              <Input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Leave empty for 1 year from save.</p>
            </div>
          </div>
        )}

        <div className="space-y-2 border-t pt-4">
          <p className="text-sm font-medium">Module access overrides</p>
          <p className="text-sm text-muted-foreground">
            Toggle features for this user beyond their plan. Switches marked &quot;customized&quot;
            override the plan default.
          </p>
          <CmsFeatureToggles
            planType={isTestAccount ? "enterprise" : plan}
            overrides={featureOverrides}
            disabled={isTestAccount}
            onChange={setFeatureOverrides}
          />
          {isTestAccount && (
            <p className="text-xs text-muted-foreground">
              Test accounts include all modules; overrides are disabled.
            </p>
          )}
        </div>

        {access.complimentary_expires_at && access.is_active && (
          <p className="text-sm text-muted-foreground">
            Expires: {format(new Date(access.complimentary_expires_at), "MMM d, yyyy")}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void saveAccess()} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Save access settings
          </Button>
          {(access.is_active || access.billing_exempt || access.is_test_account) && (
            <Button variant="outline" onClick={() => void revokeAccess()} disabled={saving}>
              Revoke complimentary access
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

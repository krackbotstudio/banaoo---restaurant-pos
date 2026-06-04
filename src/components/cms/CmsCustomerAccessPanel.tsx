import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarRange, Loader2, Save, Sparkles, Shield } from "lucide-react";
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

const PERIOD_PRESETS = [1, 3, 6, 12, 24, 36] as const;

export interface CustomerAccessState {
  is_test_account: boolean;
  billing_exempt: boolean;
  complimentary_plan: PlanType | null;
  complimentary_starts_at?: string | null;
  complimentary_expires_at: string | null;
  period_months?: number | null;
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

function toDateInputValue(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function addCalendarMonths(dateStr: string, months: number) {
  const d = new Date(`${dateStr}T12:00:00`);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() !== day) d.setDate(0);
  return d.toISOString().slice(0, 10);
}

function inferPeriodMonths(startStr: string, endStr: string) {
  if (!startStr || !endStr) return null;
  const start = new Date(`${startStr}T12:00:00`);
  const end = new Date(`${endStr}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;
  const diffMs = end.getTime() - start.getTime();
  return Math.max(1, Math.min(36, Math.round(diffMs / (30 * 24 * 60 * 60 * 1000))));
}

function resolveInitialPeriod(access: CustomerAccessState) {
  if (access.period_months && PERIOD_PRESETS.includes(access.period_months as (typeof PERIOD_PRESETS)[number])) {
    return String(access.period_months);
  }
  if (access.period_months) return "custom";
  return "12";
}

function resolveInitialStarts(access: CustomerAccessState) {
  return toDateInputValue(access.complimentary_starts_at) || todayInputValue();
}

function resolveInitialExpires(access: CustomerAccessState, starts: string, periodKey: string) {
  const fromAccess = toDateInputValue(access.complimentary_expires_at);
  if (fromAccess) return fromAccess;
  if (periodKey !== "custom") {
    return addCalendarMonths(starts, Number(periodKey));
  }
  return addCalendarMonths(starts, 12);
}

export function CmsCustomerAccessPanel({ userId, access, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [isTestAccount, setIsTestAccount] = useState(access.is_test_account);
  const [billingExempt, setBillingExempt] = useState(access.billing_exempt);
  const [plan, setPlan] = useState<PlanType>(access.complimentary_plan || "professional");
  const [periodKey, setPeriodKey] = useState(() => resolveInitialPeriod(access));
  const [customMonths, setCustomMonths] = useState(() =>
    access.period_months && !PERIOD_PRESETS.includes(access.period_months as (typeof PERIOD_PRESETS)[number])
      ? String(access.period_months)
      : "12"
  );
  const [startsAt, setStartsAt] = useState(() => resolveInitialStarts(access));
  const [expiresAt, setExpiresAt] = useState(() =>
    resolveInitialExpires(access, resolveInitialStarts(access), resolveInitialPeriod(access))
  );
  const [featureOverrides, setFeatureOverrides] = useState<FeatureOverrides>(
    access.feature_overrides ?? {}
  );

  useEffect(() => {
    const nextStarts = resolveInitialStarts(access);
    const nextPeriod = resolveInitialPeriod(access);
    setIsTestAccount(access.is_test_account);
    setBillingExempt(access.billing_exempt);
    setPlan(access.complimentary_plan || "professional");
    setPeriodKey(nextPeriod);
    setCustomMonths(
      access.period_months &&
        !PERIOD_PRESETS.includes(access.period_months as (typeof PERIOD_PRESETS)[number])
        ? String(access.period_months)
        : "12"
    );
    setStartsAt(nextStarts);
    setExpiresAt(resolveInitialExpires(access, nextStarts, nextPeriod));
    setFeatureOverrides(access.feature_overrides ?? {});
  }, [access]);

  const effectiveMonths = useMemo(() => {
    if (periodKey === "custom") {
      const n = Number(customMonths);
      return Number.isInteger(n) && n >= 1 && n <= 36 ? n : null;
    }
    return Number(periodKey);
  }, [periodKey, customMonths]);

  const periodPreview = useMemo(() => {
    if (!startsAt || !expiresAt) return null;
    const start = new Date(`${startsAt}T12:00:00`);
    const end = new Date(`${expiresAt}T12:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;
    const months = effectiveMonths ?? inferPeriodMonths(startsAt, expiresAt);
    return { start, end, months };
  }, [startsAt, expiresAt, effectiveMonths]);

  const applyPeriodToEnd = (start: string, months: number) => {
    setExpiresAt(addCalendarMonths(start, months));
  };

  const handlePeriodChange = (value: string) => {
    setPeriodKey(value);
    if (value !== "custom") {
      applyPeriodToEnd(startsAt, Number(value));
      return;
    }
    const n = Number(customMonths);
    if (Number.isInteger(n) && n >= 1 && n <= 36) {
      applyPeriodToEnd(startsAt, n);
    }
  };

  const handleStartsChange = (value: string) => {
    setStartsAt(value);
    if (periodKey !== "custom") {
      applyPeriodToEnd(value, Number(periodKey));
    } else if (effectiveMonths) {
      applyPeriodToEnd(value, effectiveMonths);
    }
  };

  const handleExpiresChange = (value: string) => {
    setExpiresAt(value);
    const inferred = inferPeriodMonths(startsAt, value);
    if (inferred && PERIOD_PRESETS.includes(inferred as (typeof PERIOD_PRESETS)[number])) {
      setPeriodKey(String(inferred));
    } else if (inferred) {
      setPeriodKey("custom");
      setCustomMonths(String(inferred));
    }
  };

  const handleCustomMonthsChange = (value: string) => {
    setCustomMonths(value);
    const n = Number(value);
    if (Number.isInteger(n) && n >= 1 && n <= 36) {
      applyPeriodToEnd(startsAt, n);
    }
  };

  const showSubscriptionPeriod = isTestAccount || billingExempt || access.is_active;

  const saveAccess = async () => {
    if (showSubscriptionPeriod && periodPreview == null && !isTestAccount) {
      toast.error("Set a valid subscription period (start before expiration)");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        is_test_account: isTestAccount,
        billing_exempt: isTestAccount ? true : billingExempt,
        complimentary_plan: isTestAccount ? "enterprise" : plan,
        feature_overrides: featureOverrides,
        sync_subscription: isTestAccount || billingExempt,
      };

      if (showSubscriptionPeriod && (billingExempt || isTestAccount)) {
        if (startsAt) {
          payload.complimentary_starts_at = new Date(`${startsAt}T00:00:00`).toISOString();
        }
        if (expiresAt) {
          payload.complimentary_expires_at = new Date(`${expiresAt}T23:59:59`).toISOString();
        }
        if (effectiveMonths) {
          payload.period_months = effectiveMonths;
        }
      }

      const res = await fetch(`${API_URL}/api/cms/customers/${userId}/access`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
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
          complimentary_starts_at: null,
          complimentary_expires_at: null,
          period_months: null,
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
              Activate a subscription for this customer with plan tier, billing period, and expiration
              dates — no Razorpay payment required.
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
              Enable an active plan without collecting payment (starter, professional, or enterprise).
            </p>
          </div>
          <Switch
            id="billing-exempt"
            checked={billingExempt || isTestAccount}
            disabled={isTestAccount}
            onCheckedChange={setBillingExempt}
          />
        </div>

        {showSubscriptionPeriod && (
          <div className="space-y-4 rounded-lg border p-4">
            <div className="space-y-1">
              <Label className="text-base flex items-center gap-2">
                <CalendarRange className="h-4 w-4" />
                Subscription period
              </Label>
              <p className="text-sm text-muted-foreground">
                Choose billing period in months and set the active window from start to expiration.
              </p>
            </div>

            {!isTestAccount && (billingExempt || access.is_active) && (
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
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Billing period</Label>
                <Select value={periodKey} onValueChange={handlePeriodChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIOD_PRESETS.map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {m} month{m === 1 ? "" : "s"}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {periodKey === "custom" && (
                <div className="space-y-1">
                  <Label>Custom months (1–36)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={36}
                    value={customMonths}
                    onChange={(e) => handleCustomMonthsChange(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label>From (start date)</Label>
                <Input type="date" value={startsAt} onChange={(e) => handleStartsChange(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>To (expiration date)</Label>
                <Input type="date" value={expiresAt} onChange={(e) => handleExpiresChange(e.target.value)} />
              </div>
            </div>

            {periodPreview && (
              <p className="text-sm rounded-md bg-muted/60 px-3 py-2">
                Active from{" "}
                <span className="font-medium">{format(periodPreview.start, "MMM d, yyyy")}</span> to{" "}
                <span className="font-medium">{format(periodPreview.end, "MMM d, yyyy")}</span>
                {periodPreview.months != null && (
                  <>
                    {" "}
                    · {periodPreview.months} month{periodPreview.months === 1 ? "" : "s"}
                  </>
                )}
              </p>
            )}

            {isTestAccount && (
              <p className="text-xs text-muted-foreground">
                Test accounts default to long-term access (10 years) if dates are left empty on save.
              </p>
            )}
          </div>
        )}

        <div className="space-y-2 border-t pt-4">
          <p className="text-sm font-medium">Module access overrides</p>
          <p className="text-sm text-muted-foreground">
            Toggle features for this user beyond their plan. Switches marked &quot;customized&quot; override
            the plan default.
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

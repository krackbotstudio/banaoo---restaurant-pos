import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CMS_BOOLEAN_FEATURES,
  CMS_NUMERIC_FEATURES,
  applyFeatureOverrides,
  hasOverride,
  isFeatureEnabled,
  planBaseLimits,
  type FeatureOverrides,
  type FeatureOverrideKey,
} from "@/lib/cms-features";
import type { PlanId } from "@/lib/plans";

interface Props {
  planType: PlanId;
  overrides: FeatureOverrides;
  onChange: (overrides: FeatureOverrides) => void;
  disabled?: boolean;
}

export function CmsFeatureToggles({ planType, overrides, onChange, disabled }: Props) {
  const base = useMemo(() => planBaseLimits(planType), [planType]);
  const effective = useMemo(() => applyFeatureOverrides(base, overrides), [base, overrides]);

  const setBoolean = (key: FeatureOverrideKey, enabled: boolean) => {
    const planDefault = base[key];
    const fromPlan = typeof planDefault === "boolean" ? planDefault : false;
    if (enabled === fromPlan) {
      const next = { ...overrides };
      delete next[key];
      onChange(next);
      return;
    }
    onChange({ ...overrides, [key]: enabled });
  };

  const setNumeric = (key: FeatureOverrideKey, raw: string) => {
    const parsed = raw === "" ? undefined : Number(raw);
    const planDefault = base[key];
    const fromPlan = typeof planDefault === "number" ? planDefault : 0;
    if (parsed === undefined || !Number.isFinite(parsed) || parsed === fromPlan) {
      const next = { ...overrides };
      delete next[key];
      onChange(next);
      return;
    }
    onChange({ ...overrides, [key]: Math.max(0, Math.round(parsed)) });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {CMS_BOOLEAN_FEATURES.map(({ key, label }) => {
          const planVal = base[key];
          const fromPlan = typeof planVal === "boolean" ? planVal : false;
          const checked = isFeatureEnabled(effective[key] as boolean | number);
          const customized = hasOverride(overrides, key);
          return (
            <div
              key={key}
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
            >
              <div className="min-w-0">
                <Label htmlFor={`feat-${key}`} className="text-sm font-medium">
                  {label}
                </Label>
                <p className="text-xs text-muted-foreground">
                  Plan default: {fromPlan ? "On" : "Off"}
                  {customized && (
                    <Badge variant="outline" className="ml-2 text-[10px] py-0">
                      customized
                    </Badge>
                  )}
                </p>
              </div>
              <Switch
                id={`feat-${key}`}
                checked={checked}
                disabled={disabled}
                onCheckedChange={(v) => setBoolean(key, v)}
              />
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {CMS_NUMERIC_FEATURES.map(({ key, label }) => {
          const planVal = base[key];
          const fromPlan = typeof planVal === "number" ? planVal : 0;
          const display =
            overrides[key] !== undefined
              ? String(overrides[key])
              : fromPlan === Infinity
                ? ""
                : String(fromPlan);
          return (
            <div key={key} className="space-y-1">
              <Label htmlFor={`num-${key}`} className="text-sm">
                {label}
              </Label>
              <Input
                id={`num-${key}`}
                type="number"
                min={0}
                placeholder={fromPlan === Infinity ? "Unlimited" : String(fromPlan)}
                value={display}
                disabled={disabled}
                onChange={(e) => setNumeric(key, e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Empty = plan default ({fromPlan === Infinity ? "unlimited" : fromPlan})
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

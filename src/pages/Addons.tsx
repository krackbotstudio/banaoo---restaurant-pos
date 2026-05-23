import { useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useSubscription } from "@/hooks/use-subscription";
import { useFeatureGating } from "@/hooks/use-feature-gating";
import { LimitIndicator } from "@/components/FeatureGate";
import type { SubscriptionAddons } from "@/lib/entitlements";
import {
  ADDON_CATALOG,
  DISCOUNTS,
  calcAddonTotal,
  getPlanDisplayName,
  type AddonType,
} from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Package, CheckCircle2, ArrowLeft } from "lucide-react";
import { NativeBillingLinkButton } from "@/components/billing/NativeBillingLinkButton";
import { isBanaooNativeApp } from "@/lib/native-app-bridge";

function addonOwnedLabel(type: AddonType, addons: SubscriptionAddons): string | null {
  if (type === "extra_outlet" && addons.extra_outlets > 0) {
    return `${addons.extra_outlets} extra outlet${addons.extra_outlets > 1 ? "s" : ""} active`;
  }
  if (type === "extra_staff" && addons.extra_staff > 0) {
    return `${addons.extra_staff} extra seat${addons.extra_staff > 1 ? "s" : ""} active`;
  }
  if (type === "swiggy_integration" && addons.swiggy) return "Swiggy add-on active";
  if (type === "zomato_integration" && addons.zomato) return "Zomato add-on active";
  if (type === "customer_ordering" && addons.customer_ordering) {
    return "Customer ordering active";
  }
  if (type === "inventory_management" && addons.inventory) {
    return "Inventory active";
  }
  return null;
}

export default function Addons() {
  const {
    subscription,
    loading,
    hasActiveSubscription,
    purchaseAddon,
    addons,
    isNativeAppBilling,
  } = useSubscription();
  const { limits, usage } = useFeatureGating();
  const [periodMonths, setPeriodMonths] = useState(1);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [paying, setPaying] = useState<string | null>(null);

  const handlePurchase = async (addonType: AddonType) => {
    const item = ADDON_CATALOG.find((a) => a.type === addonType);
    const qty = item?.stackable ? quantities[addonType] ?? 1 : 1;
    setPaying(addonType);
    await purchaseAddon(addonType, qty, periodMonths);
    setPaying(null);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6 pb-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to={isBanaooNativeApp() ? "/settings" : "/settings?tab=subscription"}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <Package className="h-6 w-6 text-primary" />
              Add-ons
            </h1>
            <p className="text-sm text-muted-foreground">
              Extend your {getPlanDisplayName(subscription?.plan_type)} plan with extra capacity and integrations.
              {isNativeAppBilling && " Purchases open in your browser — return to the app when done."}
            </p>
          </div>
        </div>

        {!hasActiveSubscription && (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="p-4 text-sm">
              You need an active subscription before purchasing add-ons.{" "}
              <NativeBillingLinkButton
                webTo="/settings?tab=subscription"
                variant="link"
                className="h-auto p-0 text-primary font-medium underline"
              >
                Choose a plan
              </NativeBillingLinkButton>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current usage</CardTitle>
            <CardDescription>Included limits plus purchased add-ons</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-6">
            <LimitIndicator feature="outlets" currentCount={usage.outlets} label="Outlets" />
            <LimitIndicator feature="staffAccounts" currentCount={usage.staff} label="Staff" />
          </CardContent>
        </Card>

        <div className="space-y-2">
          <Label>Billing period</Label>
          <Select value={String(periodMonths)} onValueChange={(v) => setPeriodMonths(Number(v))}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 3, 6, 12].map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {m} month{m > 1 ? "s" : ""}
                  {(DISCOUNTS[m] ?? 0) > 0
                    ? ` (${Math.round((DISCOUNTS[m] ?? 0) * 100)}% off)`
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {ADDON_CATALOG.map((item) => {
            const owned = addonOwnedLabel(item.type, addons);
            const qty = quantities[item.type] ?? 1;
            const total = calcAddonTotal(item.type, qty, periodMonths);
            const alreadyHas =
              item.type === "customer_ordering"
                ? limits.customerOrdering
                : item.type === "inventory_management"
                  ? limits.inventoryManagement
                  : item.type === "swiggy_integration"
                    ? limits.swiggyIntegration
                    : item.type === "zomato_integration"
                      ? limits.zomatoIntegration
                      : false;

            return (
              <Card key={item.type} className={alreadyHas && !item.stackable ? "border-green-500/30" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{item.name}</CardTitle>
                    {alreadyHas && !item.stackable && (
                      <Badge variant="secondary" className="gap-1 shrink-0">
                        <CheckCircle2 className="h-3 w-3" />
                        Included
                      </Badge>
                    )}
                    {owned && item.stackable && (
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {owned}
                      </Badge>
                    )}
                  </div>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-lg font-semibold">
                    {item.monthlyPrice != null
                      ? `₹${total.toLocaleString("en-IN")}`
                      : "Contact us"}
                    {item.monthlyPrice != null && (
                      <span className="text-sm font-normal text-muted-foreground">
                        {" "}
                        / {periodMonths} mo
                        {item.stackable && qty > 1 ? ` (${qty}×)` : ""}
                      </span>
                    )}
                  </p>

                  {item.stackable && (
                    <div className="space-y-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={qty}
                        onChange={(e) =>
                          setQuantities((prev) => ({
                            ...prev,
                            [item.type]: Math.max(
                              1,
                              Math.min(20, Number(e.target.value) || 1)
                            ),
                          }))
                        }
                        className="w-24"
                      />
                    </div>
                  )}

                  <Button
                    className="w-full"
                    disabled={
                      !hasActiveSubscription ||
                      paying === item.type ||
                      (alreadyHas && !item.stackable) ||
                      item.monthlyPrice == null
                    }
                    onClick={() => handlePurchase(item.type)}
                  >
                    {paying === item.type ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : alreadyHas && !item.stackable ? (
                      "Already active"
                    ) : isNativeAppBilling ? (
                      `Continue in browser — ₹${total.toLocaleString("en-IN")}`
                    ) : (
                      `Purchase — ₹${total.toLocaleString("en-IN")}`
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}

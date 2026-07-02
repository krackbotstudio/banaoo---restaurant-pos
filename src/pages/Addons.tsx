import { useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useSubscription } from "@/hooks/use-subscription";
import { useFeatureGating } from "@/hooks/use-feature-gating";
import { LimitIndicator } from "@/components/FeatureGate";
import type { SubscriptionAddons } from "@/lib/entitlements";
import {
  ADDON_CATALOG,
  ADDON_BILLING_PERIOD_MONTHS,
  DEFAULT_ADDON_BILLING_PERIOD_MONTHS,
  DISCOUNTS,
  billingPeriodLabel,
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
import {
  Loader2,
  Package,
  CheckCircle2,
  ArrowLeft,
  Store,
  Users,
  Globe,
  Boxes,
  Sparkles,
  Percent,
  MessageCircle,
  Truck,
} from "lucide-react";
import { NativeBillingLinkButton } from "@/components/billing/NativeBillingLinkButton";
import { AddonCardIcon } from "@/components/addons/AddonBrandLogo";
import { isBanaooNativeApp } from "@/lib/native-app-bridge";
import type { LucideIcon } from "lucide-react";

function addonOwnedLabel(type: AddonType, addons: SubscriptionAddons): string | null {
  if (type === "extra_outlet" && addons.extra_outlets > 0) {
    return `${addons.extra_outlets} extra outlet${addons.extra_outlets > 1 ? "s" : ""} active`;
  }
  if (type === "extra_staff" && addons.extra_staff > 0) {
    return `${addons.extra_staff} extra seat${addons.extra_staff > 1 ? "s" : ""} active`;
  }
  if (type === "swiggy_integration" && addons.swiggy) return "Swiggy add-on active";
  if (type === "zomato_integration" && addons.zomato) return "Zomato add-on active";
  if (type === "customer_ordering" && addons.customer_ordering) return "Customer ordering active";
  if (type === "inventory_management" && addons.inventory) return "Inventory active";
  if (type === "whatsapp_integration" && addons.whatsapp) return "WhatsApp active";
  if (type === "shiprocket_delivery" && addons.shiprocket) return "Shiprocket delivery active";
  return null;
}

const ADDON_META: Record<
  AddonType,
  { icon: LucideIcon; gradient: string; accent: string; category: string }
> = {
  extra_outlet: {
    icon: Store,
    gradient: "from-blue-500/12 via-blue-500/5 to-transparent",
    accent: "border-blue-500/25",
    category: "Capacity",
  },
  extra_staff: {
    icon: Users,
    gradient: "from-violet-500/12 via-violet-500/5 to-transparent",
    accent: "border-violet-500/25",
    category: "Capacity",
  },
  customer_ordering: {
    icon: Globe,
    gradient: "from-emerald-500/12 via-emerald-500/5 to-transparent",
    accent: "border-emerald-500/25",
    category: "Customer experience",
  },
  inventory_management: {
    icon: Boxes,
    gradient: "from-amber-500/12 via-amber-500/5 to-transparent",
    accent: "border-amber-500/25",
    category: "Operations",
  },
  swiggy_integration: {
    icon: Sparkles,
    gradient: "from-orange-500/15 via-orange-500/5 to-transparent",
    accent: "border-orange-500/30",
    category: "Integrations",
  },
  zomato_integration: {
    icon: Sparkles,
    gradient: "from-red-500/12 via-red-500/5 to-transparent",
    accent: "border-red-500/25",
    category: "Integrations",
  },
  whatsapp_integration: {
    icon: MessageCircle,
    gradient: "from-green-500/12 via-green-500/5 to-transparent",
    accent: "border-green-500/30",
    category: "Customer experience",
  },
  shiprocket_delivery: {
    icon: Truck,
    gradient: "from-sky-500/12 via-sky-500/5 to-transparent",
    accent: "border-sky-500/30",
    category: "Integrations",
  },
};

const CATEGORY_ORDER = ["Capacity", "Customer experience", "Operations", "Integrations"];

export default function Addons() {
  const {
    subscription,
    loading,
    hasActiveSubscription,
    hasComplimentaryAccess,
    accessSource,
    purchaseAddon,
    addons,
    isNativeAppBilling,
    refetch,
  } = useSubscription();
  const { limits, usage } = useFeatureGating();
  const [periodMonths, setPeriodMonths] = useState(DEFAULT_ADDON_BILLING_PERIOD_MONTHS);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [paying, setPaying] = useState<string | null>(null);

  const handlePurchase = async (addonType: AddonType) => {
    const item = ADDON_CATALOG.find((a) => a.type === addonType);
    const qty = item?.stackable ? quantities[addonType] ?? 1 : 1;
    setPaying(addonType);
    await purchaseAddon(addonType, qty, periodMonths);
    setPaying(null);
  };

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: ADDON_CATALOG.filter((a) => ADDON_META[a.type].category === cat),
  })).filter((g) => g.items.length > 0);

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
      <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-8 pb-12">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.07] via-background to-accent/[0.05] p-6 md:p-8">
          <div className="absolute -right-12 top-0 h-40 w-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          <div className="relative space-y-4">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 bg-background/80 border-border/80 text-muted-foreground hover:text-foreground shadow-sm"
              asChild
            >
              <Link to={isBanaooNativeApp() ? "/settings" : "/settings?tab=subscription"}>
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to subscription
              </Link>
            </Button>
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-primary">
                <Package className="h-3.5 w-3.5" />
                Extend your plan
              </div>
              <h1 className="font-display text-3xl font-bold tracking-tight">Add-ons</h1>
              <p className="text-muted-foreground text-sm md:text-base">
                Boost capacity, unlock customer ordering, inventory, and delivery integrations on
                your {getPlanDisplayName(subscription?.plan_type)} plan. Add-ons bill from 1 month
                — platform plans start at 3 months.
                {isNativeAppBilling && " Purchases open in your browser — return when done."}
              </p>
            </div>
          </div>
        </div>

        {hasComplimentaryAccess && (
          <Card className="border-emerald-500/40 bg-gradient-to-r from-emerald-500/10 to-transparent">
            <CardContent className="p-4 text-sm flex flex-wrap items-center justify-between gap-3">
              <span>
                <strong className="text-foreground">Admin access active</strong>
                {" — "}
                {accessSource === "test_account"
                  ? "Test account (full features, no payment)."
                  : "Complimentary plan from CMS (no add-on payment required)."}
              </span>
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                Refresh access
              </Button>
            </CardContent>
          </Card>
        )}

        {!hasActiveSubscription && (
          <Card className="border-amber-500/40 bg-gradient-to-r from-amber-500/10 to-transparent">
            <CardContent className="p-4 text-sm flex flex-wrap items-center gap-2">
              <span>You need an active subscription before purchasing add-ons.</span>
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

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-2 border-border/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Current usage</CardTitle>
              <CardDescription>Included limits plus purchased add-ons</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-8">
              <LimitIndicator feature="outlets" currentCount={usage.outlets} label="Outlets" />
              <LimitIndicator feature="staffAccounts" currentCount={usage.staff} label="Staff" />
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/[0.03]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Percent className="h-4 w-4 text-primary" />
                Billing period
              </CardTitle>
              <CardDescription>1-month minimum · longer periods save more</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={String(periodMonths)} onValueChange={(v) => setPeriodMonths(Number(v))}>
                <SelectTrigger className="w-full bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADDON_BILLING_PERIOD_MONTHS.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {billingPeriodLabel(m)}
                      {(DISCOUNTS[m] ?? 0) > 0
                        ? ` — ${Math.round((DISCOUNTS[m] ?? 0) * 100)}% off`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        {grouped.map(({ category, items }) => (
          <section key={category} className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground px-1">
              {category}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => {
                const meta = ADDON_META[item.type];
                const Icon = meta.icon;
                const owned = addonOwnedLabel(item.type, addons);
                const qty = quantities[item.type] ?? 1;
                const total = calcAddonTotal(item.type, qty, periodMonths);
                const alreadyHas =
                  item.type === "customer_ordering"
                    ? limits.customerOrdering
                    : item.type === "inventory_management"
                      ? limits.inventoryManagement
                      : item.type === "whatsapp_integration"
                        ? limits.whatsappIntegration
                        : item.type === "shiprocket_delivery"
                          ? limits.shiprocketDelivery
                          : item.type === "swiggy_integration"
                          ? limits.swiggyIntegration
                          : item.type === "zomato_integration"
                            ? limits.zomatoIntegration
                            : false;

                const includedInPlan =
                  item.type === "extra_staff"
                    ? limits.staffAccounts === Infinity
                    : item.type === "extra_outlet"
                      ? limits.outlets === Infinity
                      : false;

                return (
                  <Card
                    key={item.type}
                    className={`relative overflow-hidden transition-shadow hover:shadow-elevated ${
                      alreadyHas && !item.stackable ? "border-green-500/35" : meta.accent
                    }`}
                  >
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${meta.gradient} pointer-events-none`}
                    />
                    <CardHeader className="relative pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-background/90 border border-border/60 shadow-sm shrink-0">
                            <AddonCardIcon type={item.type} fallbackIcon={Icon} />
                          </div>
                          <CardTitle className="text-base leading-snug">{item.name}</CardTitle>
                        </div>
                        {includedInPlan && (
                          <Badge className="bg-green-500/15 text-green-700 border-green-500/25 gap-1 shrink-0">
                            <CheckCircle2 className="h-3 w-3" />
                            Included
                          </Badge>
                        )}
                        {alreadyHas && !item.stackable && !includedInPlan && (
                          <Badge className="bg-green-500/15 text-green-700 border-green-500/25 gap-1 shrink-0">
                            <CheckCircle2 className="h-3 w-3" />
                            Active
                          </Badge>
                        )}
                        {owned && item.stackable && (
                          <Badge variant="outline" className="shrink-0 text-xs bg-background/80">
                            {owned}
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="relative mt-2">{item.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="relative space-y-4">
                      <div>
                        <p className="text-2xl font-bold tracking-tight">
                          {item.monthlyPrice == null
                            ? "Contact us"
                            : item.monthlyPrice === 0
                              ? "Free"
                              : `₹${total.toLocaleString("en-IN")}`}
                        </p>
                        {item.monthlyPrice != null && item.monthlyPrice > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            for {periodMonths} month{periodMonths !== 1 ? "s" : ""}
                            {item.stackable && qty > 1 ? ` · ${qty} units` : ""}
                          </p>
                        )}
                        {item.monthlyPrice === 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5">No payment required</p>
                        )}
                      </div>

                      {item.stackable && (
                        <div className="space-y-2">
                          <Label className="text-xs">Quantity</Label>
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
                            className="w-24 bg-background/80"
                          />
                        </div>
                      )}

                      <Button
                        className={`w-full ${!(alreadyHas && !item.stackable) && !includedInPlan ? "gradient-warm text-white border-0" : ""}`}
                        variant={alreadyHas && !item.stackable || includedInPlan ? "secondary" : "default"}
                        disabled={
                          !hasActiveSubscription ||
                          hasComplimentaryAccess ||
                          paying === item.type ||
                          includedInPlan ||
                          (alreadyHas && !item.stackable) ||
                          item.monthlyPrice == null
                        }
                        onClick={() => handlePurchase(item.type)}
                      >
                        {paying === item.type ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : includedInPlan ? (
                          "Included in your plan"
                        ) : alreadyHas && !item.stackable ? (
                          "Already active"
                        ) : hasComplimentaryAccess ? (
                          "Included via admin access"
                        ) : isNativeAppBilling ? (
                          item.monthlyPrice === 0
                            ? "Activate free in browser"
                            : `Continue in browser — ₹${total.toLocaleString("en-IN")}`
                        ) : item.monthlyPrice === 0 ? (
                          "Activate free"
                        ) : (
                          `Purchase — ₹${total.toLocaleString("en-IN")}`
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </AppLayout>
  );
}

import { useMemo } from "react";
import { useSubscription } from "./use-subscription";
import { UPGRADE_MESSAGES, DEFAULT_LIMITS, type PlanLimits } from "@/lib/plans";

export type { PlanLimits };
export type FeatureKey = keyof PlanLimits;

const ADDON_FEATURES: FeatureKey[] = [
  "outlets",
  "staffAccounts",
  "customerOrdering",
  "inventoryManagement",
  "whatsappIntegration",
  "swiggyIntegration",
  "zomatoIntegration",
  "shiprocketDelivery",
  "razorpayPayments",
  "googlePayIndia",
];

export function useFeatureGating() {
  const {
    subscription,
    hasActiveSubscription,
    hasComplimentaryAccess,
    effectiveLimits,
    usage,
    addons,
    loading,
  } = useSubscription();

  const planType = subscription?.plan_type || null;

  const limits = useMemo(() => {
    if (loading) return effectiveLimits;
    if (!hasActiveSubscription) return DEFAULT_LIMITS;
    return effectiveLimits;
  }, [loading, hasActiveSubscription, effectiveLimits]);

  const canAccess = (feature: FeatureKey): boolean => {
    if (loading) return false;
    if (hasComplimentaryAccess) return true;
    if (!hasActiveSubscription) return false;
    const limit = limits[feature];
    if (typeof limit === "boolean") return limit;
    if (typeof limit === "number") return limit > 0;
    return false;
  };

  const getLimit = (feature: FeatureKey): number | boolean => {
    return limits[feature];
  };

  const isWithinLimit = (feature: FeatureKey, currentCount: number): boolean => {
    if (loading) return true;
    if (hasComplimentaryAccess) return true;
    const limit = limits[feature];
    if (typeof limit === "number") {
      if (limit === Infinity) return true;
      return currentCount < limit;
    }
    return Boolean(limit);
  };

  const getUpgradeMessage = (feature: FeatureKey): string => {
    return UPGRADE_MESSAGES[feature];
  };

  const isAddonFeature = (feature: FeatureKey): boolean =>
    ADDON_FEATURES.includes(feature);

  const getUsageCount = (feature: FeatureKey): number => {
    if (feature === "outlets") return usage.outlets;
    if (feature === "staffAccounts") return usage.staff;
    return 0;
  };

  return {
    planType,
    limits,
    addons,
    usage,
    hasActiveSubscription,
    hasComplimentaryAccess,
    loading,
    canAccess,
    getLimit,
    isWithinLimit,
    getUpgradeMessage,
    isAddonFeature,
    getUsageCount,
  };
}

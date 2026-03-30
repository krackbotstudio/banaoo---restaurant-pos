import { useMemo } from "react";
import { useSubscription } from "./use-subscription";

export interface PlanLimits {
  outlets: number;
  staffAccounts: number;
  aiMenuImport: boolean;
  kitchenDisplay: boolean;
  analytics: boolean;
  tableManagement: boolean;
  qrMenus: number;
  platformIntegrations: boolean;
}

const PLAN_LIMITS: Record<string, PlanLimits> = {
  starter: {
    outlets: 1,
    staffAccounts: 5,
    aiMenuImport: false,
    kitchenDisplay: true,
    analytics: false,
    tableManagement: false,
    qrMenus: 3,
    platformIntegrations: false,
  },
  professional: {
    outlets: 3,
    staffAccounts: Infinity,
    aiMenuImport: true,
    kitchenDisplay: true,
    analytics: true,
    tableManagement: true,
    qrMenus: Infinity,
    platformIntegrations: true,
  },
  enterprise: {
    outlets: Infinity,
    staffAccounts: Infinity,
    aiMenuImport: true,
    kitchenDisplay: true,
    analytics: true,
    tableManagement: true,
    qrMenus: Infinity,
    platformIntegrations: true,
  },
};

const DEFAULT_LIMITS: PlanLimits = {
  outlets: 0,
  staffAccounts: 0,
  aiMenuImport: false,
  kitchenDisplay: false,
  analytics: false,
  tableManagement: false,
  qrMenus: 0,
  platformIntegrations: false,
};

export type FeatureKey = keyof PlanLimits;

export function useFeatureGating() {
  const { subscription, isTrialing, isActive } = useSubscription();

  const planType = subscription?.plan_type || null;
  const hasActiveSubscription = isTrialing || isActive;

  const limits = useMemo(() => {
    if (!hasActiveSubscription || !planType) {
      return DEFAULT_LIMITS;
    }
    return PLAN_LIMITS[planType] || DEFAULT_LIMITS;
  }, [hasActiveSubscription, planType]);

  const canAccess = (feature: FeatureKey): boolean => {
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
    const limit = limits[feature];
    if (typeof limit === "number") {
      return currentCount < limit;
    }
    return Boolean(limit);
  };

  const getUpgradeMessage = (feature: FeatureKey): string => {
    const messages: Record<FeatureKey, string> = {
      outlets: "Upgrade to Professional to add more outlets",
      staffAccounts: "Upgrade to Professional for unlimited staff accounts",
      aiMenuImport: "AI Menu Import is available on Professional plan",
      kitchenDisplay: "Kitchen Display is available on Professional plan",
      analytics: "Analytics is available on Professional plan",
      tableManagement: "Table Management is available on Professional plan",
      qrMenus: "Upgrade to Professional for unlimited QR menus",
      platformIntegrations: "Platform Integrations are available on Professional plan",
    };
    return messages[feature];
  };

  return {
    planType,
    limits,
    hasActiveSubscription,
    canAccess,
    getLimit,
    isWithinLimit,
    getUpgradeMessage,
  };
}

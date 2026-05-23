import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  EMPTY_ADDONS,
  deserializeLimits,
  type SubscriptionAddons,
  type PlanLimitsApi,
} from "@/lib/entitlements";
import type { PlanLimits, AddonType } from "@/lib/plans";
import { ADDON_CATALOG, getAddonCatalogItem } from "@/lib/plans";
import {
  BILLING_COMPLETE_EVENT,
  createMobileBillingLink,
  isBanaooNativeApp,
  openBillingInExternalBrowser,
} from "@/lib/native-app-bridge";

export interface Subscription {
  id: string;
  user_id: string;
  plan_type: "starter" | "professional" | "enterprise";
  status: "trialing" | "active" | "cancelled" | "past_due" | "expired";
  trial_ends_at: string | null;
  expires_at: string | null;
  period_months: number | null;
  razorpay_subscription_id: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export interface SubscriptionUsage {
  outlets: number;
  staff: number;
}

export interface EntitlementsPayload {
  subscription: Subscription | null;
  addons: SubscriptionAddons;
  effective_limits: PlanLimits;
  usage: SubscriptionUsage;
  has_active_subscription: boolean;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any;
  }
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
    document.body.appendChild(script);
  });
}

function parseEntitlementsResponse(data: unknown): EntitlementsPayload {
  if (!data || typeof data !== "object") {
    return {
      subscription: null,
      addons: { ...EMPTY_ADDONS },
      effective_limits: deserializeLimits({
        outlets: 0,
        staffAccounts: 0,
        kitchenDisplay: false,
        analytics: false,
        tableManagement: false,
        mobileAppAccess: false,
        platformIntegrations: false,
        swiggyIntegration: false,
        zomatoIntegration: false,
        customerOrdering: false,
        inventoryManagement: false,
        aiMenuImport: false,
        qrMenus: 0,
      }),
      usage: { outlets: 0, staff: 0 },
      has_active_subscription: false,
    };
  }

  const obj = data as Record<string, unknown>;

  if ("subscription" in obj || "effective_limits" in obj) {
    const limitsApi = (obj.effective_limits ?? {}) as PlanLimitsApi;
    return {
      subscription: (obj.subscription as Subscription | null) ?? null,
      addons: { ...EMPTY_ADDONS, ...(obj.addons as SubscriptionAddons) },
      effective_limits: deserializeLimits({
        outlets: 0,
        staffAccounts: 0,
        kitchenDisplay: false,
        analytics: false,
        tableManagement: false,
        mobileAppAccess: false,
        platformIntegrations: false,
        swiggyIntegration: false,
        zomatoIntegration: false,
        customerOrdering: false,
        inventoryManagement: false,
        aiMenuImport: false,
        qrMenus: 0,
        ...limitsApi,
      }),
      usage: {
        outlets: Number((obj.usage as SubscriptionUsage)?.outlets) || 0,
        staff: Number((obj.usage as SubscriptionUsage)?.staff) || 0,
      },
      has_active_subscription: Boolean(obj.has_active_subscription),
    };
  }

  const sub = obj as unknown as Subscription;
  const expiresAt = sub.expires_at
    ? new Date(sub.expires_at)
    : sub.trial_ends_at
      ? new Date(sub.trial_ends_at)
      : null;
  const isExpired = expiresAt ? expiresAt < new Date() : false;
  const hasActive =
    (sub.status === "active" || sub.status === "trialing") && !isExpired;

  return {
    subscription: sub.id ? sub : null,
    addons: { ...EMPTY_ADDONS },
    effective_limits: deserializeLimits({
      outlets: 0,
      staffAccounts: 0,
      kitchenDisplay: false,
      analytics: false,
      tableManagement: false,
      mobileAppAccess: false,
      platformIntegrations: false,
      swiggyIntegration: false,
      zomatoIntegration: false,
      customerOrdering: false,
      inventoryManagement: false,
      aiMenuImport: false,
      qrMenus: 0,
    }),
    usage: { outlets: 0, staff: 0 },
    has_active_subscription: hasActive,
  };
}

export function useSubscription() {
  const { user, profile, profileLoading } = useAuth();
  const [entitlements, setEntitlements] = useState<EntitlementsPayload>(() =>
    parseEntitlementsResponse(null)
  );
  const [loading, setLoading] = useState(true);

  const subscription = entitlements.subscription;

  const fetchSubscription = useCallback(
    async (attemptNumber = 0) => {
      if (!user) {
        setEntitlements(parseEntitlementsResponse(null));
        setLoading(false);
        return;
      }

      if (profileLoading) return;
      if (!profile) return;

      setLoading(true);
      try {
        const API_URL = import.meta.env.VITE_API_URL ?? "";
        const res = await fetch(`${API_URL}/api/subscription`, {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });

        if (res.status === 401 && attemptNumber < 3) {
          const delay = (attemptNumber + 1) * 500;
          await new Promise((resolve) => setTimeout(resolve, delay));
          return fetchSubscription(attemptNumber + 1);
        }

        if (!res.ok) throw new Error("Failed to fetch subscription from backend");
        const data = await res.json();
        setEntitlements(parseEntitlementsResponse(data));
      } catch (error) {
        console.error("Error fetching subscription:", error);
      } finally {
        setLoading(false);
      }
    },
    [user, profile, profileLoading]
  );

  useEffect(() => {
    if (!profileLoading) {
      fetchSubscription();
    }
  }, [fetchSubscription, profileLoading]);

  useEffect(() => {
    const onBillingComplete = () => {
      void fetchSubscription();
    };
    window.addEventListener(BILLING_COMPLETE_EVENT, onBillingComplete);
    return () => window.removeEventListener(BILLING_COMPLETE_EVENT, onBillingComplete);
  }, [fetchSubscription]);

  const expiresAt = subscription?.expires_at
    ? new Date(subscription.expires_at)
    : subscription?.trial_ends_at
      ? new Date(subscription.trial_ends_at)
      : null;

  const isExpired = expiresAt ? expiresAt < new Date() : false;
  const isTrialing = subscription?.status === "trialing";
  const isActive =
    (subscription?.status === "active" || isTrialing) && !isExpired;
  const isPastDue = subscription?.status === "past_due";
  const hasActiveSubscription =
    entitlements.has_active_subscription || (isActive && !isExpired);

  const daysUntilExpiry = expiresAt
    ? Math.max(
        0,
        Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      )
    : 0;

  const daysRemaining = daysUntilExpiry;

  const openRazorpayCheckout = async (opts: {
    orderData: {
      order_id: string;
      amount: number;
      currency: string;
      key_id: string;
    };
    description: string;
    onSuccess: (response: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }) => Promise<void>;
  }): Promise<boolean> => {
    if (!user) {
      toast.error("Please log in first");
      return false;
    }
    await loadRazorpayScript();
    const { orderData, description, onSuccess } = opts;
    return new Promise((resolve) => {
      const rzp = new window.Razorpay({
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "banaoo.io",
        description,
        order_id: orderData.order_id,
        prefill: { email: user.email ?? "" },
        theme: { color: "#f97316" },
        modal: { ondismiss: () => resolve(false) },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            await onSuccess(response);
            await fetchSubscription();
            resolve(true);
          } catch (err) {
            console.error("Payment verification error:", err);
            toast.error(
              "Payment received but activation failed. Contact connect@banaoo.in"
            );
            resolve(false);
          }
        },
      });
      rzp.open();
    });
  };

  const createOrder = (
    planType: "starter" | "professional",
    periodMonths: number
  ): Promise<boolean> => {
    return (async () => {
      if (!user) {
        toast.error("Please log in first");
        return false;
      }
      if (isBanaooNativeApp()) {
        try {
          const url = await createMobileBillingLink({
            kind: "subscription",
            plan_type: planType,
            period_months: periodMonths,
          });
          openBillingInExternalBrowser(url);
          toast.info(
            "Opening your browser to complete payment. Return to the app when finished."
          );
          return true;
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Could not open browser checkout"
          );
          return false;
        }
      }
      try {
        const API_URL = import.meta.env.VITE_API_URL ?? "";
        const res = await fetch(`${API_URL}/api/payments/create-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan_type: planType,
            period_months: periodMonths,
          }),
          credentials: "include",
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Failed to create payment order");
        }

        const orderData = await res.json();
        const planNames: Record<string, string> = {
          starter: "Launcher",
          professional: "Growth",
          enterprise: "Expand",
        };

        return openRazorpayCheckout({
          orderData,
          description: `${planNames[planType]} Plan — ${periodMonths} month${periodMonths > 1 ? "s" : ""}`,
          onSuccess: async (response) => {
            const verifyRes = await fetch(
              `${API_URL}/api/payments/verify-payment`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...response,
                  plan_type: planType,
                  period_months: periodMonths,
                }),
                credentials: "include",
              }
            );
            if (!verifyRes.ok) {
              const verifyData = await verifyRes.json();
              throw new Error(verifyData.error || "Payment verification failed");
            }
            toast.success("Payment successful! Your subscription is now active.");
          },
        });
      } catch (err) {
        console.error("createOrder error:", err);
        toast.error(
          err instanceof Error ? err.message : "Failed to initiate payment"
        );
        return false;
      }
    })();
  };

  const purchaseAddon = (
    addonType: AddonType,
    quantity: number,
    periodMonths: number
  ): Promise<boolean> => {
    return (async () => {
      if (!user) {
        toast.error("Please log in first");
        return false;
      }
      const item = getAddonCatalogItem(addonType);
      if (!item) {
        toast.error("Unknown add-on");
        return false;
      }
      if (isBanaooNativeApp()) {
        try {
          const url = await createMobileBillingLink({
            kind: "addon",
            addon_type: addonType,
            quantity,
            period_months: periodMonths,
          });
          openBillingInExternalBrowser(url);
          toast.info(
            "Opening your browser to complete payment. Return to the app when finished."
          );
          return true;
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Could not open browser checkout"
          );
          return false;
        }
      }
      try {
        const API_URL = import.meta.env.VITE_API_URL ?? "";
        const res = await fetch(`${API_URL}/api/payments/create-addon-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            addon_type: addonType,
            quantity,
            period_months: periodMonths,
          }),
          credentials: "include",
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Failed to create add-on order");
        }

        const orderData = await res.json();
        const qtyLabel = item.stackable && quantity > 1 ? ` ×${quantity}` : "";

        return openRazorpayCheckout({
          orderData,
          description: `${item.name}${qtyLabel} — ${periodMonths} month${periodMonths > 1 ? "s" : ""}`,
          onSuccess: async (response) => {
            const verifyRes = await fetch(
              `${API_URL}/api/payments/verify-addon-payment`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...response,
                  addon_type: addonType,
                  quantity,
                  period_months: periodMonths,
                }),
                credentials: "include",
              }
            );
            if (!verifyRes.ok) {
              const verifyData = await verifyRes.json();
              throw new Error(verifyData.error || "Payment verification failed");
            }
            toast.success(`${item.name} activated!`);
          },
        });
      } catch (err) {
        console.error("purchaseAddon error:", err);
        toast.error(
          err instanceof Error ? err.message : "Failed to initiate payment"
        );
        return false;
      }
    })();
  };

  const createSubscription = async (
    planType: "starter" | "professional",
    _action?: "convert" | "change_plan"
  ) => {
    const success = await createOrder(planType, 1);
    return success
      ? { subscription_id: null, short_url: null, trial_ends_at: null }
      : null;
  };

  const cancelSubscription = async () => {
    if (!subscription) {
      toast.error("No active subscription");
      return false;
    }
    try {
      const API_URL = import.meta.env.VITE_API_URL ?? "";
      const res = await fetch(`${API_URL}/api/payments/cancel-subscription`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to cancel subscription");
      }
      toast.success("Subscription cancelled");
      await fetchSubscription();
      return true;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to cancel subscription"
      );
      return false;
    }
  };

  return {
    subscription,
    addons: entitlements.addons,
    effectiveLimits: entitlements.effective_limits,
    usage: entitlements.usage,
    loading,
    isTrialing,
    isActive,
    isPastDue,
    hasActiveSubscription,
    expiresAt,
    daysUntilExpiry,
    daysRemaining,
    createOrder,
    purchaseAddon,
    createSubscription,
    cancelSubscription,
    refetch: fetchSubscription,
    addonCatalog: ADDON_CATALOG,
    isNativeAppBilling: isBanaooNativeApp(),
  };
}

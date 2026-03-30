import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

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

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any;
  }
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) { resolve(); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
    document.body.appendChild(script);
  });
}

export function useSubscription() {
  const { user, profile, profileLoading } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = useCallback(async (attemptNumber = 0) => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    
    // Don't fetch until profile is loaded (ensures session is fully established)
    if (profileLoading) {
      return;
    }
    
    // Additional check: make sure profile actually exists (not just loaded)
    // This ensures the session is fully established after OAuth
    if (!profile) {
      console.log('Profile not available yet, waiting...');
      return;
    }
    
    setLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await fetch(`${API_URL}/api/subscription`, {
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Subscription response status:', res.status);
      
      // Handle 401 by retrying up to 3 times with increasing delays (for OAuth race condition)
      if (res.status === 401 && attemptNumber < 3) {
        const delay = (attemptNumber + 1) * 500;
        console.log(`Got 401, retrying in ${delay}ms (attempt ${attemptNumber + 1}/3)...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchSubscription(attemptNumber + 1);
      }
      
      if (!res.ok) throw new Error("Failed to fetch subscription from backend");
      const data = await res.json();
      setSubscription(data as Subscription | null);
    } catch (error) {
      console.error("Error fetching subscription:", error);
    } finally {
      setLoading(false);
    }
  }, [user, profile, profileLoading]);

  useEffect(() => { 
    if (!profileLoading) {
      fetchSubscription(); 
    }
  }, [fetchSubscription, profileLoading]);

  // For prepaid subs check expires_at; for legacy trialing check trial_ends_at
  const expiresAt = subscription?.expires_at
    ? new Date(subscription.expires_at)
    : subscription?.trial_ends_at
    ? new Date(subscription.trial_ends_at)
    : null;

  const isExpired = expiresAt ? expiresAt < new Date() : false;
  const isTrialing = subscription?.status === "trialing";
  const isActive = (subscription?.status === "active" || isTrialing) && !isExpired;
  const isPastDue = subscription?.status === "past_due";
  const hasActiveSubscription = isActive && !isExpired;

  const daysUntilExpiry = expiresAt
    ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const daysRemaining = daysUntilExpiry; // legacy alias

  /**
   * Create a Razorpay order and open the inline checkout modal.
   */
  const createOrder = (
    planType: "starter" | "professional",
    periodMonths: number
  ): Promise<boolean> => {
    return new Promise(async (resolve) => {
      if (!user) { toast.error("Please log in first"); return resolve(false); }

      try {
        const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
        const res = await fetch(`${API_URL}/api/payments/create-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan_type: planType, period_months: periodMonths }),
          credentials: "include",
        });
        
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Failed to create payment order");
        }
        
        const orderData = await res.json();

        await loadRazorpayScript();

        const planNames: Record<string, string> = { starter: "Starter", professional: "Professional" };

        const rzp = new window.Razorpay({
          key: orderData.key_id,
          amount: orderData.amount,
          currency: orderData.currency,
          name: "banaoo.io",
          description: `${planNames[planType]} Plan — ${periodMonths} month${periodMonths > 1 ? "s" : ""}`,
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
              const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
              const verifyRes = await fetch(`${API_URL}/api/payments/verify-payment`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  plan_type: planType,
                  period_months: periodMonths,
                }),
                credentials: "include",
              });

              if (!verifyRes.ok) {
                const verifyData = await verifyRes.json();
                throw new Error(verifyData.error || "Payment verification failed");
              }

              await fetchSubscription();
              toast.success("Payment successful! Your subscription is now active.");
              resolve(true);
            } catch (err) {
              console.error("Payment verification error:", err);
              toast.error("Payment received but activation failed. Contact connect@banaoo.in");
              resolve(false);
            }
          },
        });

        rzp.open();
      } catch (err) {
        console.error("createOrder error:", err);
        toast.error(err instanceof Error ? err.message : "Failed to initiate payment");
        resolve(false);
      }
    });
  };

  /** Legacy alias kept for existing callers */
  const createSubscription = async (
    planType: "starter" | "professional",
    _action?: "convert" | "change_plan"
  ) => {
    const success = await createOrder(planType, 1);
    return success ? { subscription_id: null, short_url: null, trial_ends_at: null } : null;
  };

  const cancelSubscription = async () => {
    if (!subscription) { toast.error("No active subscription"); return false; }
    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
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
      toast.error(err instanceof Error ? err.message : "Failed to cancel subscription");
      return false;
    }
  };

  return {
    subscription,
    loading,
    isTrialing,
    isActive,
    isPastDue,
    hasActiveSubscription,
    expiresAt,
    daysUntilExpiry,
    daysRemaining,
    createOrder,
    createSubscription,
    cancelSubscription,
    refetch: fetchSubscription,
  };
}

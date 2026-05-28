import { useCallback, useEffect, useState } from "react";
import { API_URL } from "@/lib/api-url";
import { toast } from "sonner";

export interface PaymentMethod {
  id: string;
  type: "card" | "upi";
  brand: string;
  last4?: string | null;
  vpa?: string | null;
  exp_month?: number | null;
  exp_year?: number | null;
  is_default: boolean;
  created_at: string;
}

export interface BillingInvoice {
  id: string;
  invoice_number: string;
  kind: "subscription" | "addon";
  description: string;
  amount_rupees: number;
  status: string;
  period_months: number | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  paid_at: string;
  expires_at: string | null;
}

export interface ActiveAddonRow {
  id: string;
  addon_type: string;
  label: string;
  quantity: number;
  status: string;
  period_months: number | null;
  expires_at: string | null;
  created_at: string;
  is_active: boolean;
}

export interface BillingSettings {
  billing_auto_pay: boolean;
  billing_email: string | null;
  payment_methods: PaymentMethod[];
}

export function useBillingOverview(enabled: boolean) {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<BillingSettings | null>(null);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [activeAddons, setActiveAddons] = useState<ActiveAddonRow[]>([]);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/billing/overview`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to load billing");
      setSettings((data as { settings: BillingSettings }).settings);
      setInvoices((data as { invoices: BillingInvoice[] }).invoices || []);
      setActiveAddons((data as { active_addons: ActiveAddonRow[] }).active_addons || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load billing");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) void fetchOverview();
  }, [enabled, fetchOverview]);

  const updateSettings = async (patch: Partial<BillingSettings>) => {
    const res = await fetch(`${API_URL}/api/billing/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(patch),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to save settings");
    setSettings((data as { settings: BillingSettings }).settings);
    return data;
  };

  const addPaymentMethod = async (body: Record<string, unknown>) => {
    const res = await fetch(`${API_URL}/api/billing/payment-methods`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to add payment method");
    setSettings((prev) =>
      prev ? { ...prev, payment_methods: (data as { payment_methods: PaymentMethod[] }).payment_methods } : prev
    );
  };

  const removePaymentMethod = async (id: string) => {
    const res = await fetch(`${API_URL}/api/billing/payment-methods/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to remove");
    setSettings((prev) =>
      prev ? { ...prev, payment_methods: (data as { payment_methods: PaymentMethod[] }).payment_methods } : prev
    );
  };

  const setDefaultPaymentMethod = async (id: string) => {
    const res = await fetch(`${API_URL}/api/billing/payment-methods/${id}/default`, {
      method: "POST",
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to update default");
    setSettings((prev) =>
      prev ? { ...prev, payment_methods: (data as { payment_methods: PaymentMethod[] }).payment_methods } : prev
    );
  };

  return {
    loading,
    settings,
    invoices,
    activeAddons,
    fetchOverview,
    updateSettings,
    addPaymentMethod,
    removePaymentMethod,
    setDefaultPaymentMethod,
  };
}

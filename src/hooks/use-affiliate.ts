import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

interface Affiliate {
  id: string;
  user_id: string;
  referral_code: string;
  status: "pending" | "approved" | "rejected";
  payment_details: {
    upi_id?: string;
    bank_name?: string;
    account_number?: string;
    ifsc_code?: string;
  } | null;
  created_at: string;
  approved_at: string | null;
}

interface AffiliateReferral {
  id: string;
  affiliate_id: string;
  referred_user_id: string;
  referred_outlet_id: string | null;
  referral_date: string;
  status: string;
}

interface AffiliateCommission {
  id: string;
  affiliate_id: string;
  referral_id: string;
  amount: number;
  status: string;
  period_start: string | null;
  period_end: string | null;
  paid_at: string | null;
  created_at: string;
}

interface AffiliatePayout {
  id: string;
  affiliate_id: string;
  amount: number;
  status: string;
  payment_method: string;
  payment_details: Record<string, unknown>;
  transaction_id: string | null;
  requested_at: string;
  processed_at: string | null;
  notes: string | null;
}

interface AffiliateStats {
  totalReferrals: number;
  activeReferrals: number;
  pendingReferrals: number;
  totalEarnings: number;
  pendingEarnings: number;
  paidEarnings: number;
  pendingPayouts: number;
}

export function useAffiliate() {
  const { user } = useAuth();
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [referrals, setReferrals] = useState<AffiliateReferral[]>([]);
  const [commissions, setCommissions] = useState<AffiliateCommission[]>([]);
  const [payouts, setPayouts] = useState<AffiliatePayout[]>([]);
  const [stats, setStats] = useState<AffiliateStats>({
    totalReferrals: 0,
    activeReferrals: 0,
    pendingReferrals: 0,
    totalEarnings: 0,
    pendingEarnings: 0,
    paidEarnings: 0,
    pendingPayouts: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchAffiliate = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("affiliates")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching affiliate:", error);
        return;
      }

      if (data) {
        setAffiliate(data as Affiliate);
      }
    } catch (err) {
      console.error("Error:", err);
    }
  }, [user]);

  const fetchReferrals = useCallback(async () => {
    if (!affiliate) return;

    try {
      const { data, error } = await supabase
        .from("affiliate_referrals")
        .select("*")
        .eq("affiliate_id", affiliate.id)
        .order("referral_date", { ascending: false });

      if (error) {
        console.error("Error fetching referrals:", error);
        return;
      }

      setReferrals(data || []);
    } catch (err) {
      console.error("Error:", err);
    }
  }, [affiliate]);

  const fetchCommissions = useCallback(async () => {
    if (!affiliate) return;

    try {
      const { data, error } = await supabase
        .from("affiliate_commissions")
        .select("*")
        .eq("affiliate_id", affiliate.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching commissions:", error);
        return;
      }

      setCommissions(data || []);
    } catch (err) {
      console.error("Error:", err);
    }
  }, [affiliate]);

  const fetchPayouts = useCallback(async () => {
    if (!affiliate) return;

    try {
      const { data, error } = await supabase
        .from("affiliate_payouts")
        .select("*")
        .eq("affiliate_id", affiliate.id)
        .order("requested_at", { ascending: false });

      if (error) {
        console.error("Error fetching payouts:", error);
        return;
      }

      setPayouts((data || []) as AffiliatePayout[]);
    } catch (err) {
      console.error("Error:", err);
    }
  }, [affiliate]);

  const calculateStats = useCallback(() => {
    const totalReferrals = referrals.length;
    const activeReferrals = referrals.filter((r) => r.status === "active").length;
    const pendingReferrals = referrals.filter((r) => r.status === "pending").length;

    const totalEarnings = commissions.reduce((sum, c) => sum + Number(c.amount), 0);
    const pendingEarnings = commissions
      .filter((c) => c.status === "pending")
      .reduce((sum, c) => sum + Number(c.amount), 0);
    const paidEarnings = commissions
      .filter((c) => c.status === "paid")
      .reduce((sum, c) => sum + Number(c.amount), 0);

    const pendingPayouts = payouts
      .filter((p) => p.status === "requested" || p.status === "processing")
      .reduce((sum, p) => sum + Number(p.amount), 0);

    setStats({
      totalReferrals,
      activeReferrals,
      pendingReferrals,
      totalEarnings,
      pendingEarnings,
      paidEarnings,
      pendingPayouts,
    });
  }, [referrals, commissions, payouts]);

  const requestPayout = async (amount: number, paymentMethod: string) => {
    if (!affiliate) throw new Error("No affiliate record");
    if (affiliate.status !== "approved") throw new Error("Affiliate not approved");

    const { data, error } = await supabase
      .from("affiliate_payouts")
      .insert({
        affiliate_id: affiliate.id,
        amount,
        payment_method: paymentMethod,
        payment_details: affiliate.payment_details || {},
        status: "requested",
      })
      .select()
      .single();

    if (error) throw error;

    await fetchPayouts();
    return data;
  };

  const updatePaymentDetails = async (paymentDetails: Affiliate["payment_details"]) => {
    if (!affiliate) throw new Error("No affiliate record");

    const { error } = await supabase
      .from("affiliates")
      .update({ payment_details: paymentDetails })
      .eq("id", affiliate.id);

    if (error) throw error;

    await fetchAffiliate();
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchAffiliate();
      setLoading(false);
    };

    if (user) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [user, fetchAffiliate]);

  useEffect(() => {
    if (affiliate) {
      Promise.all([fetchReferrals(), fetchCommissions(), fetchPayouts()]);
    }
  }, [affiliate, fetchReferrals, fetchCommissions, fetchPayouts]);

  useEffect(() => {
    calculateStats();
  }, [calculateStats]);

  return {
    affiliate,
    referrals,
    commissions,
    payouts,
    stats,
    loading,
    isApproved: affiliate?.status === "approved",
    isPending: affiliate?.status === "pending",
    isRejected: affiliate?.status === "rejected",
    requestPayout,
    updatePaymentDetails,
    refetch: async () => {
      await fetchAffiliate();
      if (affiliate) {
        await Promise.all([fetchReferrals(), fetchCommissions(), fetchPayouts()]);
      }
    },
  };
}

import { useState, useEffect, useCallback } from "react";
import { API_URL } from "@/lib/api-url";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Loader2,
  Mail,
  Phone,
  Building2,
  Download,
  Smartphone,
  Wallet,
  Ban,
  ShieldCheck,
  ShieldAlert,
  Info,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Link } from "react-router-dom";

interface Account {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  business_type: string | null;
  role: string;
  account_status: string;
  onboarding_completed: boolean;
  created_at: string;
  terms_accepted_at: string | null;
  terms_version: string | null;
  terms_accepted_ip: string | null;
  terms_accepted_user_agent: string | null;
  is_test_account?: boolean;
  billing_exempt?: boolean;
  complimentary_plan?: string | null;
}

interface MobileAppLead {
  id: string;
  email: string;
  phone: string;
  source: string;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
}

interface AffiliateApplication {
  id: string;
  user_id: string;
  referral_code: string;
  status: "pending" | "approved" | "suspended";
  created_at: string;
  approved_at: string | null;
  payment_details: Record<string, unknown> | null;
  email: string | null;
  full_name: string | null;
  phone: string | null;
}

interface AffiliatePayout {
  id: string;
  affiliate_id: string;
  amount: number;
  status: "requested" | "processing" | "completed" | "failed";
  payment_method: string;
  payment_details: Record<string, unknown> | null;
  transaction_id: string | null;
  requested_at: string;
  processed_at: string | null;
  notes: string | null;
  referral_code: string | null;
  email: string | null;
  full_name: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", variant: "secondary" },
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
};

export function AccountsPanel() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [leads, setLeads] = useState<MobileAppLead[]>([]);
  const [affiliates, setAffiliates] = useState<AffiliateApplication[]>([]);
  const [affiliatePayouts, setAffiliatePayouts] = useState<AffiliatePayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [affiliatesLoading, setAffiliatesLoading] = useState(false);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "approved" | "all">("pending");
  const [adminTab, setAdminTab] = useState<"accounts" | "affiliates" | "payouts" | "leads">("accounts");

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/accounts?status=${filter}`, {
        headers: {
          'Accept': 'application/json',
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch accounts');
      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const fetchLeads = useCallback(async () => {
    setLeadsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/mobile-app-leads?limit=250`, {
        headers: { Accept: "application/json" },
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch app leads");
      const data = await response.json();
      setLeads((data.leads || []) as MobileAppLead[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load app leads");
    } finally {
      setLeadsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (adminTab === "leads") void fetchLeads();
  }, [adminTab, fetchLeads]);

  const fetchAffiliates = useCallback(async () => {
    setAffiliatesLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/affiliates?status=all`, {
        headers: { Accept: "application/json" },
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch affiliates");
      const data = await response.json();
      setAffiliates((data.affiliates || []) as AffiliateApplication[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load affiliates");
    } finally {
      setAffiliatesLoading(false);
    }
  }, []);

  const fetchAffiliatePayouts = useCallback(async () => {
    setPayoutsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/affiliate-payouts?status=all`, {
        headers: { Accept: "application/json" },
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch affiliate payouts");
      const data = await response.json();
      setAffiliatePayouts((data.payouts || []) as AffiliatePayout[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load affiliate payouts");
    } finally {
      setPayoutsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (adminTab === "affiliates") void fetchAffiliates();
    if (adminTab === "payouts") void fetchAffiliatePayouts();
  }, [adminTab, fetchAffiliates, fetchAffiliatePayouts]);

  const downloadLeadsCsv = () => {
    if (leads.length === 0) {
      toast.info("No leads available to export");
      return;
    }
    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const rows = leads.map((lead) =>
      [
        lead.created_at,
        lead.email,
        lead.phone,
        lead.source,
        lead.ip_address || "",
        lead.user_agent || "",
      ]
        .map((value) => escapeCsv(String(value)))
        .join(",")
    );
    const csv = [
      "created_at,email,phone,source,ip_address,user_agent",
      ...rows,
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `mobile-app-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleAction = async (userId: string, action: "approve" | "reject") => {
    setActioning(userId);
    try {
      const response = await fetch(`${API_URL}/api/admin/accounts/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ target_user_id: userId, action }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(data?.error || "Action failed");
      toast.success(action === "approve" ? "Account approved! User has been notified." : "Account rejected. User has been notified.");
      await fetchAccounts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to perform action");
    } finally {
      setActioning(null);
    }
  };

  const handleAffiliateAction = async (affiliateId: string, action: "approve" | "suspend") => {
    setActioning(affiliateId);
    try {
      const response = await fetch(`${API_URL}/api/admin/affiliates/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ affiliate_id: affiliateId, action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) throw new Error(data?.error || "Action failed");
      toast.success(action === "approve" ? "Affiliate approved" : "Affiliate suspended");
      await fetchAffiliates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update affiliate status");
    } finally {
      setActioning(null);
    }
  };

  const handlePayoutAction = async (
    payoutId: string,
    status: "processing" | "completed" | "failed"
  ) => {
    setActioning(payoutId);
    try {
      const response = await fetch(`${API_URL}/api/admin/affiliate-payouts/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ payout_id: payoutId, status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) throw new Error(data?.error || "Action failed");
      toast.success(`Payout marked as ${status}`);
      await fetchAffiliatePayouts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update payout");
    } finally {
      setActioning(null);
    }
  };

  const pendingCount = accounts.filter((a) => a.account_status === "pending").length;

  return (
    <div className="max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <img src="/tectangle-logo.png" alt="" className="h-4 w-4 object-contain" />
              <span>Tectangle CMS</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Customer management</h1>
            <p className="text-muted-foreground mt-1">
              Approve owners, manage affiliates, payouts, and app download leads
            </p>
          </div>
          {adminTab === "accounts" ? (
            <Button variant="outline" size="sm" onClick={fetchAccounts} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          ) : adminTab === "affiliates" ? (
            <Button variant="outline" size="sm" onClick={fetchAffiliates} disabled={affiliatesLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${affiliatesLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          ) : adminTab === "payouts" ? (
            <Button variant="outline" size="sm" onClick={fetchAffiliatePayouts} disabled={payoutsLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${payoutsLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchLeads} disabled={leadsLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${leadsLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button size="sm" onClick={downloadLeadsCsv}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          )}
        </div>

        <Tabs value={adminTab} onValueChange={(v) => setAdminTab(v as typeof adminTab)}>
          <TabsList>
            <TabsTrigger value="accounts" className="gap-2">
              <Users className="h-4 w-4" />
              Accounts
            </TabsTrigger>
            <TabsTrigger value="affiliates" className="gap-2">
              <Users className="h-4 w-4" />
              Affiliates
            </TabsTrigger>
            <TabsTrigger value="payouts" className="gap-2">
              <Wallet className="h-4 w-4" />
              Affiliate Payouts
            </TabsTrigger>
            <TabsTrigger value="leads" className="gap-2">
              <Smartphone className="h-4 w-4" />
              App Leads
            </TabsTrigger>
          </TabsList>

          <TabsContent value="accounts" className="mt-4 space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Pending Review", value: accounts.filter((a) => a.account_status === "pending").length, color: "text-amber-600" },
                { label: "Approved", value: accounts.filter((a) => a.account_status === "approved").length, color: "text-green-600" },
                { label: "Rejected", value: accounts.filter((a) => a.account_status === "rejected").length, color: "text-destructive" },
              ].map((stat) => (
                <Card key={stat.label}>
                  <CardContent className="pt-4 pb-4">
                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <TabsList>
                <TabsTrigger value="pending" className="gap-2">
                  <Clock className="h-4 w-4" />
                  Pending
                  {pendingCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 text-[10px]">{pendingCount}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="approved">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Approved
                </TabsTrigger>
                <TabsTrigger value="all">
                  <Users className="h-4 w-4 mr-2" />
                  All
                </TabsTrigger>
              </TabsList>

              {(["pending", "approved", "all"] as const).map((tab) => (
                <TabsContent key={tab} value={tab} className="mt-4">
                  {loading ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : accounts.length === 0 ? (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
                        <Users className="h-10 w-10 text-muted-foreground/40" />
                        <div>
                          <p className="font-medium">No accounts found</p>
                          <p className="text-sm text-muted-foreground">
                            {tab === "pending" ? "No pending applications at the moment." : "Nothing to show here."}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {accounts.map((account) => (
                        <Card key={account.id}>
                          <CardContent className="py-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-2 flex-1 min-w-0">
                                <div className="flex items-center gap-3 flex-wrap">
                                  <h3 className="font-semibold text-lg truncate">{account.full_name || "—"}</h3>
                                  <Badge variant={STATUS_CONFIG[account.account_status]?.variant || "outline"}>
                                    {STATUS_CONFIG[account.account_status]?.label || account.account_status}
                                  </Badge>
                                  {account.onboarding_completed && (
                                    <Badge variant="outline" className="text-xs">Onboarding done</Badge>
                                  )}
                                  {account.is_test_account && (
                                    <Badge variant="outline" className="text-xs border-amber-500 text-amber-700">
                                      Test account
                                    </Badge>
                                  )}
                                  {account.billing_exempt && !account.is_test_account && (
                                    <Badge variant="outline" className="text-xs">
                                      Complimentary · {account.complimentary_plan || "plan"}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                                  {account.email && (
                                    <span className="flex items-center gap-1.5">
                                      <Mail className="h-3.5 w-3.5" />
                                      {account.email}
                                    </span>
                                  )}
                                  {account.phone && (
                                    <span className="flex items-center gap-1.5">
                                      <Phone className="h-3.5 w-3.5" />
                                      {account.phone}
                                    </span>
                                  )}
                                  {account.business_type && (
                                    <span className="flex items-center gap-1.5">
                                      <Building2 className="h-3.5 w-3.5" />
                                      {account.business_type}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Registered {format(new Date(account.created_at), "MMM d, yyyy 'at' h:mm a")}
                                </p>
                                <div className="flex items-center gap-1.5 text-xs">
                                  {account.terms_accepted_at ? (
                                    <>
                                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                      <span className="text-muted-foreground">
                                        T&amp;C accepted{" "}
                                        {format(new Date(account.terms_accepted_at), "MMM d, yyyy")}
                                        {account.terms_version
                                          ? ` · v${account.terms_version}`
                                          : ""}
                                      </span>
                                      {(account.terms_accepted_ip || account.terms_accepted_user_agent) && (
                                        <TooltipProvider delayDuration={150}>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <button
                                                type="button"
                                                className="text-muted-foreground hover:text-foreground"
                                                aria-label="View acceptance details"
                                              >
                                                <Info className="h-3.5 w-3.5" />
                                              </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom" align="start" className="max-w-xs text-xs">
                                              <p className="font-medium mb-1">Acceptance audit</p>
                                              {account.terms_accepted_ip && (
                                                <p><span className="text-muted-foreground">IP:</span> {account.terms_accepted_ip}</p>
                                              )}
                                              {account.terms_accepted_user_agent && (
                                                <p className="break-words">
                                                  <span className="text-muted-foreground">UA:</span>{" "}
                                                  {account.terms_accepted_user_agent}
                                                </p>
                                              )}
                                              <p className="mt-1">
                                                <span className="text-muted-foreground">At:</span>{" "}
                                                {format(new Date(account.terms_accepted_at), "MMM d, yyyy 'at' h:mm:ss a")}
                                              </p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      <ShieldAlert className="h-3.5 w-3.5 text-destructive shrink-0" />
                                      <Badge variant="destructive" className="h-5 text-[10px] px-1.5">
                                        T&amp;C not accepted
                                      </Badge>
                                    </>
                                  )}
                                </div>
                              </div>

                              {account.account_status === "pending" && (
                                <div className="flex gap-2 flex-shrink-0">
                                  <Button size="sm" variant="outline" asChild>
                                    <Link to={`/cms/customers/${account.user_id}`}>View account</Link>
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-9 gap-1.5 bg-green-600 hover:bg-green-700 text-white border-0"
                                    onClick={() => handleAction(account.user_id, "approve")}
                                    disabled={actioning === account.user_id}
                                  >
                                    {actioning === account.user_id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                    )}
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-9 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                                    onClick={() => handleAction(account.user_id, "reject")}
                                    disabled={actioning === account.user_id}
                                  >
                                    <XCircle className="h-3.5 w-3.5" />
                                    Reject
                                  </Button>
                                </div>
                              )}
                              {account.account_status === "approved" && (
                                <div className="flex gap-2 flex-shrink-0">
                                  <Button size="sm" variant="outline" asChild>
                                    <Link to={`/cms/customers/${account.user_id}`}>View account</Link>
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-9 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 flex-shrink-0"
                                    onClick={() => handleAction(account.user_id, "reject")}
                                    disabled={actioning === account.user_id}
                                  >
                                    <XCircle className="h-3.5 w-3.5" />
                                    Revoke
                                  </Button>
                                </div>
                              )}
                              {account.account_status === "rejected" && (
                                <div className="flex gap-2 flex-shrink-0">
                                  <Button size="sm" variant="outline" asChild>
                                    <Link to={`/cms/customers/${account.user_id}`}>View account</Link>
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-9 gap-1.5 bg-green-600 hover:bg-green-700 text-white border-0 flex-shrink-0"
                                    onClick={() => handleAction(account.user_id, "approve")}
                                    disabled={actioning === account.user_id}
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Approve
                                  </Button>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>

          <TabsContent value="affiliates" className="mt-4">
            {affiliatesLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : affiliates.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <Users className="h-10 w-10 text-muted-foreground/40" />
                  <div>
                    <p className="font-medium">No affiliate applications</p>
                    <p className="text-sm text-muted-foreground">New affiliate signup requests will appear here.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {affiliates.map((item) => (
                  <Card key={item.id}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold truncate">{item.full_name || item.email || "Affiliate"}</p>
                            <Badge
                              variant={
                                item.status === "approved"
                                  ? "default"
                                  : item.status === "pending"
                                  ? "secondary"
                                  : "destructive"
                              }
                              className="capitalize"
                            >
                              {item.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {item.email || "No email"} {item.phone ? `· ${item.phone}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Referral code: <span className="font-mono">{item.referral_code}</span> · Applied{" "}
                            {format(new Date(item.created_at), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {item.status !== "approved" ? (
                            <Button
                              size="sm"
                              className="h-9 gap-1.5 bg-green-600 hover:bg-green-700 text-white border-0"
                              onClick={() => handleAffiliateAction(item.id, "approve")}
                              disabled={actioning === item.id}
                            >
                              {actioning === item.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              )}
                              Approve
                            </Button>
                          ) : null}
                          {item.status !== "suspended" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                              onClick={() => handleAffiliateAction(item.id, "suspend")}
                              disabled={actioning === item.id}
                            >
                              <Ban className="h-3.5 w-3.5" />
                              Suspend
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="payouts" className="mt-4">
            {payoutsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : affiliatePayouts.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <Wallet className="h-10 w-10 text-muted-foreground/40" />
                  <div>
                    <p className="font-medium">No payout requests</p>
                    <p className="text-sm text-muted-foreground">Affiliate payout requests will appear here.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {affiliatePayouts.map((payout) => (
                  <Card key={payout.id}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold">{payout.full_name || payout.email || "Affiliate"}</p>
                            <Badge variant={payout.status === "completed" ? "default" : payout.status === "failed" ? "destructive" : "secondary"} className="capitalize">
                              {payout.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            ₹{Number(payout.amount).toFixed(2)} · {payout.payment_method.replace("_", " ")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Requested {format(new Date(payout.requested_at), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {payout.status === "requested" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePayoutAction(payout.id, "processing")}
                              disabled={actioning === payout.id}
                            >
                              Mark Processing
                            </Button>
                          ) : null}
                          {payout.status !== "completed" ? (
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => handlePayoutAction(payout.id, "completed")}
                              disabled={actioning === payout.id}
                            >
                              Complete
                            </Button>
                          ) : null}
                          {payout.status !== "failed" && payout.status !== "completed" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive border-destructive/30 hover:bg-destructive/10"
                              onClick={() => handlePayoutAction(payout.id, "failed")}
                              disabled={actioning === payout.id}
                            >
                              Fail
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="leads" className="mt-4">
            {leadsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : leads.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <Smartphone className="h-10 w-10 text-muted-foreground/40" />
                  <div>
                    <p className="font-medium">No app leads yet</p>
                    <p className="text-sm text-muted-foreground">
                      Leads from the Android app download form will appear here.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Android App Download Leads</CardTitle>
                  <CardDescription>
                    Latest {leads.length} submissions from landing page download requests.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {leads.map((lead, index) => (
                    <div key={lead.id}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{lead.email}</p>
                          <p className="text-sm text-muted-foreground">{lead.phone}</p>
                          <p className="text-xs text-muted-foreground">
                            Source: {lead.source} · {format(new Date(lead.created_at), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {lead.ip_address ? <p>IP: {lead.ip_address}</p> : null}
                        </div>
                      </div>
                      {index < leads.length - 1 ? <Separator className="mt-3" /> : null}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
    </div>
  );
}

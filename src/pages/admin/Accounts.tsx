import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
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
  ChefHat,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

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
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", variant: "secondary" },
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
};

export default function AdminAccounts() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "approved" | "all">("pending");

  // Redirect non-admins back to the landing page
  useEffect(() => {
    if (!authLoading && profile && !profile.is_admin) {
      navigate("/");
    }
  }, [profile, authLoading, navigate]);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/admin/accounts?status=${filter}`, {
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
    if (profile?.is_admin) fetchAccounts();
  }, [fetchAccounts, profile]);

  const handleAction = async (userId: string, action: "approve" | "reject") => {
    setActioning(userId);
    try {
      const response = await fetch('http://localhost:5000/api/admin/accounts/action', {
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

  if (authLoading || !profile?.is_admin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const pendingCount = accounts.filter((a) => a.account_status === "pending").length;

  return (
    <AppLayout>
      <div className="container max-w-5xl py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <ChefHat className="h-3.5 w-3.5" />
              <span>banaoo Admin</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Account Approvals</h1>
            <p className="text-muted-foreground mt-1">
              Review and approve restaurant owner accounts
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAccounts} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

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

        {/* Tabs */}
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
                          {/* Account info */}
                          <div className="space-y-2 flex-1 min-w-0">
                            <div className="flex items-center gap-3 flex-wrap">
                              <h3 className="font-semibold text-lg truncate">{account.full_name || "—"}</h3>
                              <Badge variant={STATUS_CONFIG[account.account_status]?.variant || "outline"}>
                                {STATUS_CONFIG[account.account_status]?.label || account.account_status}
                              </Badge>
                              {account.onboarding_completed && (
                                <Badge variant="outline" className="text-xs">Onboarding done</Badge>
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
                          </div>

                          {/* Actions */}
                          {account.account_status === "pending" && (
                            <div className="flex gap-2 flex-shrink-0">
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
                          )}
                          {account.account_status === "rejected" && (
                            <Button
                              size="sm"
                              className="h-9 gap-1.5 bg-green-600 hover:bg-green-700 text-white border-0 flex-shrink-0"
                              onClick={() => handleAction(account.user_id, "approve")}
                              disabled={actioning === account.user_id}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Approve
                            </Button>
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
      </div>
    </AppLayout>
  );
}

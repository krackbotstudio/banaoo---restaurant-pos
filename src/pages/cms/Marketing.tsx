import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Download, Loader2, Megaphone, Search, Smartphone, UserPlus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { API_URL } from "@/lib/api-url";
import { toast } from "sonner";

interface MarketingStats {
  total_leads: number;
  leads_last_7_days: number;
  affiliates_pending: number;
  affiliates_approved: number;
  affiliates_suspended: number;
}

interface LeadSource {
  source: string;
  count: number;
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

interface AffiliateRow {
  id: string;
  referral_code: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  email: string;
  full_name: string | null;
}

export default function CmsMarketing() {
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [stats, setStats] = useState<MarketingStats | null>(null);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [leads, setLeads] = useState<MobileAppLead[]>([]);
  const [affiliates, setAffiliates] = useState<AffiliateRow[]>([]);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [affiliateStatus, setAffiliateStatus] = useState("pending");

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const res = await fetch(`${API_URL}/api/cms/marketing/overview`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load overview");
      setStats(data.stats);
      setSources(data.lead_sources ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load marketing overview");
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  const loadLeads = useCallback(async () => {
    setLoadingLeads(true);
    try {
      const qs = new URLSearchParams();
      qs.set("limit", "250");
      if (search.trim()) qs.set("search", search.trim());
      if (sourceFilter !== "all") qs.set("source", sourceFilter);
      const res = await fetch(`${API_URL}/api/cms/marketing/leads?${qs.toString()}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load leads");
      setLeads(data.leads ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load leads");
    } finally {
      setLoadingLeads(false);
    }
  }, [search, sourceFilter]);

  const loadAffiliates = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_URL}/api/cms/marketing/affiliates?status=${affiliateStatus}`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load affiliates");
      setAffiliates(data.affiliates ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load affiliates");
    }
  }, [affiliateStatus]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    void loadAffiliates();
  }, [loadAffiliates]);

  const exportLeads = async () => {
    setExporting(true);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set("search", search.trim());
      if (sourceFilter !== "all") qs.set("source", sourceFilter);
      const res = await fetch(
        `${API_URL}/api/cms/marketing/leads/export?${qs.toString()}`,
        { credentials: "include" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `mobile-app-leads-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Leads exported");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const sourceOptions = ["all", ...sources.map((s) => s.source)];

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marketing</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Mobile app leads, affiliate pipeline, and growth exports.
          </p>
        </div>
        <Badge variant="secondary">Phase 6</Badge>
      </div>

      {loadingOverview ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                Total leads
              </CardDescription>
              <CardTitle className="text-2xl tabular-nums">{stats.total_leads}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Last 7 days</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{stats.leads_last_7_days}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Affiliates pending</CardDescription>
              <CardTitle className="text-2xl tabular-nums text-amber-600 dark:text-amber-400">
                {stats.affiliates_pending}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Affiliates approved</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{stats.affiliates_approved}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Affiliates suspended</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{stats.affiliates_suspended}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      ) : null}

      <Tabs defaultValue="leads">
        <TabsList>
          <TabsTrigger value="leads">Mobile app leads</TabsTrigger>
          <TabsTrigger value="affiliates">Affiliate pipeline</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Megaphone className="h-4 w-4" />
                Lead capture
              </CardTitle>
              <CardDescription>APK download requests from landing and marketing pages</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row">
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="md:w-[200px]">
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s === "all" ? "All sources" : s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative md:flex-1">
                  <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    className="pl-9"
                    placeholder="Search email or phone"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Button variant="outline" onClick={() => void loadLeads()}>
                  Apply
                </Button>
                <Button onClick={() => void exportLeads()} disabled={exporting}>
                  {exporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </>
                  )}
                </Button>
              </div>

              {loadingLeads ? (
                <div className="py-10 flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : leads.length === 0 ? (
                <p className="text-sm text-muted-foreground">No leads match your filters.</p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr className="text-left">
                        <th className="p-3 font-medium">Date</th>
                        <th className="p-3 font-medium">Email</th>
                        <th className="p-3 font-medium">Phone</th>
                        <th className="p-3 font-medium">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leads.map((lead) => (
                        <tr key={lead.id} className="border-t">
                          <td className="p-3 text-muted-foreground whitespace-nowrap">
                            {format(new Date(lead.created_at), "MMM d, yyyy HH:mm")}
                          </td>
                          <td className="p-3">{lead.email}</td>
                          <td className="p-3">{lead.phone}</td>
                          <td className="p-3">
                            <Badge variant="outline">{lead.source}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="affiliates" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Affiliate applications
              </CardTitle>
              <CardDescription>
                Quick view — full approve/suspend actions remain in Customers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={affiliateStatus} onValueChange={setAffiliateStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">pending</SelectItem>
                  <SelectItem value="approved">approved</SelectItem>
                  <SelectItem value="suspended">suspended</SelectItem>
                  <SelectItem value="all">all</SelectItem>
                </SelectContent>
              </Select>

              {affiliates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No affiliates in this status.</p>
              ) : (
                <ul className="divide-y border rounded-lg">
                  {affiliates.map((a) => (
                    <li key={a.id} className="p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{a.full_name || a.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.referral_code} · {format(new Date(a.created_at), "MMM d, yyyy")}
                        </p>
                      </div>
                      <Badge variant={a.status === "approved" ? "default" : "secondary"}>
                        {a.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

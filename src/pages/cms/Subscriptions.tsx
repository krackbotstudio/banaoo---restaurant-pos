import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, CreditCard, Loader2, Save, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { API_URL } from "@/lib/api-url";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { useCmsAuth } from "@/lib/cms-auth";
import { CmsFeatureToggles } from "@/components/cms/CmsFeatureToggles";
import type { FeatureOverrides } from "@/lib/cms-features";

type PlanType = "starter" | "professional" | "enterprise";
type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled";

interface CmsSubscription {
  id: string;
  user_id: string;
  plan_type: PlanType;
  status: SubscriptionStatus;
  period_months: number | null;
  expires_at: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  created_at: string;
  email: string;
  full_name: string | null;
  is_test_account?: boolean;
  billing_exempt?: boolean;
  feature_overrides?: FeatureOverrides;
}

interface RowDraft {
  plan_type: PlanType;
  status: SubscriptionStatus;
  feature_overrides: FeatureOverrides;
  featuresOpen: boolean;
}

function draftFromRow(row: CmsSubscription): RowDraft {
  return {
    plan_type: row.plan_type,
    status: row.status,
    feature_overrides: { ...(row.feature_overrides ?? {}) },
    featuresOpen: false,
  };
}

export default function CmsSubscriptions() {
  const { admin } = useCmsAuth();
  const canEdit = admin?.role === "super_admin" || admin?.role === "billing";
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rows, setRows] = useState<CmsSubscription[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [status, setStatus] = useState<"all" | SubscriptionStatus>("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set("status", status);
      if (search.trim()) qs.set("search", search.trim());
      const res = await fetch(`${API_URL}/api/cms/subscriptions?${qs.toString()}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load subscriptions");
      const list: CmsSubscription[] = data.subscriptions ?? [];
      setRows(list);
      const nextDrafts: Record<string, RowDraft> = {};
      for (const row of list) {
        nextDrafts[row.id] = draftFromRow(row);
      }
      setDrafts(nextDrafts);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load subscriptions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [status]);

  const updateDraft = (id: string, patch: Partial<RowDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  };

  const saveRow = async (row: CmsSubscription) => {
    if (!canEdit) {
      toast.error("Only billing and super admins can edit subscriptions");
      return;
    }
    const draft = drafts[row.id];
    if (!draft) return;

    setSavingId(row.id);
    try {
      const [subRes, featRes] = await Promise.all([
        fetch(`${API_URL}/api/cms/subscriptions/${row.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            plan_type: draft.plan_type,
            status: draft.status,
          }),
        }),
        fetch(`${API_URL}/api/cms/customers/${row.user_id}/features`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ feature_overrides: draft.feature_overrides }),
        }),
      ]);

      const subData = await subRes.json();
      const featData = await featRes.json();
      if (!subRes.ok) throw new Error(subData.error || "Failed to update subscription");
      if (!featRes.ok) throw new Error(featData.error || "Failed to update features");

      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? {
                ...r,
                ...subData.subscription,
                feature_overrides: featData.feature_overrides ?? draft.feature_overrides,
              }
            : r
        )
      );
      setDrafts((prev) => ({
        ...prev,
        [row.id]: {
          ...draft,
          plan_type: subData.subscription.plan_type,
          status: subData.subscription.status,
          feature_overrides: featData.feature_overrides ?? draft.feature_overrides,
        },
      }));
      toast.success("Plan and features saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingId(null);
    }
  };

  const dirtyCount = useMemo(() => {
    return rows.filter((row) => {
      const d = drafts[row.id];
      if (!d) return false;
      return (
        d.plan_type !== row.plan_type ||
        d.status !== row.status ||
        JSON.stringify(d.feature_overrides) !== JSON.stringify(row.feature_overrides ?? {})
      );
    }).length;
  }, [rows, drafts]);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subscriptions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select a plan per customer and enable specific modules without payment.
          </p>
        </div>
        {dirtyCount > 0 && (
          <Badge variant="secondary">{dirtyCount} unsaved</Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Subscription operations
          </CardTitle>
          <CardDescription>Filter, set plan tier, status, and per-user module access</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <Select value={status} onValueChange={(v) => setStatus(v as "all" | SubscriptionStatus)}>
              <SelectTrigger className="md:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="trialing">Trialing</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="past_due">Past due</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative md:flex-1">
              <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                className="pl-9"
                placeholder="Search by email or name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={() => void load()}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Apply
            </Button>
          </div>

          {loading ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No subscriptions found for current filters.</p>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => {
                const draft = drafts[row.id] ?? draftFromRow(row);
                const isDirty =
                  draft.plan_type !== row.plan_type ||
                  draft.status !== row.status ||
                  JSON.stringify(draft.feature_overrides) !==
                    JSON.stringify(row.feature_overrides ?? {});

                return (
                  <div key={row.id} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{row.full_name || row.email}</p>
                        <p className="text-xs text-muted-foreground truncate">{row.email}</p>
                      </div>
                      <div className="flex flex-wrap gap-1 justify-end">
                        {row.is_test_account && (
                          <Badge variant="outline" className="text-xs border-amber-500 text-amber-700">
                            Test
                          </Badge>
                        )}
                        {row.billing_exempt && !row.is_test_account && (
                          <Badge variant="outline" className="text-xs">
                            Complimentary
                          </Badge>
                        )}
                        <Badge variant={draft.status === "active" ? "default" : "secondary"}>
                          {draft.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-1">
                        <Label>Plan</Label>
                        <Select
                          value={draft.plan_type}
                          disabled={!canEdit || savingId === row.id}
                          onValueChange={(v) => updateDraft(row.id, { plan_type: v as PlanType })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="starter">Starter</SelectItem>
                            <SelectItem value="professional">Professional</SelectItem>
                            <SelectItem value="enterprise">Enterprise</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Status</Label>
                        <Select
                          value={draft.status}
                          disabled={!canEdit || savingId === row.id}
                          onValueChange={(v) =>
                            updateDraft(row.id, { status: v as SubscriptionStatus })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="trialing">Trialing</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="past_due">Past due</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground md:pt-6">
                        <p>
                          Period: <span className="text-foreground">{row.period_months ?? "—"}</span>
                        </p>
                        <p>
                          Expires:{" "}
                          <span className="text-foreground">
                            {row.expires_at ? new Date(row.expires_at).toLocaleDateString() : "—"}
                          </span>
                        </p>
                      </div>
                    </div>

                    <Collapsible
                      open={draft.featuresOpen}
                      onOpenChange={(open) => updateDraft(row.id, { featuresOpen: open })}
                    >
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full justify-between px-2">
                          <span>Module access for this user</span>
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${draft.featuresOpen ? "rotate-180" : ""}`}
                          />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-3">
                        <CmsFeatureToggles
                          planType={draft.plan_type}
                          overrides={draft.feature_overrides}
                          disabled={!canEdit || savingId === row.id}
                          onChange={(feature_overrides) =>
                            updateDraft(row.id, { feature_overrides })
                          }
                        />
                      </CollapsibleContent>
                    </Collapsible>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        disabled={!canEdit || savingId === row.id || !isDirty}
                        onClick={() => void saveRow(row)}
                      >
                        {savingId === row.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-1" />
                        )}
                        Save plan & features
                      </Button>
                      {isDirty && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={savingId === row.id}
                          onClick={() => updateDraft(row.id, draftFromRow(row))}
                        >
                          Reset
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

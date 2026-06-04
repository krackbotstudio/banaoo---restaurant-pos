import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { API_URL } from "@/lib/api-url";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CmsFeatureToggles } from "@/components/cms/CmsFeatureToggles";
import type { FeatureOverrides } from "@/lib/cms-features";
import {
  CmsCustomerAccessPanel,
  type CustomerAccessState,
} from "@/components/cms/CmsCustomerAccessPanel";
import { CmsCustomerMenuPanel } from "@/components/cms/CmsCustomerMenuPanel";

type AccountStatus = "pending" | "approved" | "rejected";
type PlanType = "starter" | "professional" | "enterprise";
type SubStatus = "trialing" | "active" | "past_due" | "cancelled";

interface Profile {
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  business_type: string | null;
  account_status: AccountStatus;
  onboarding_completed: boolean;
  created_at: string;
}

interface OverviewResponse {
  profile: Profile;
  usage: { outlets: number; staff: number };
  outlets?: Array<{ id: string; name: string; address: string | null; is_active: boolean }>;
  access?: CustomerAccessState;
  latest_subscription: null | {
    id: string;
    plan_type: PlanType;
    status: SubStatus;
    period_months: number;
    expires_at: string | null;
    current_period_end: string | null;
    created_at: string;
  };
}

interface OrderRow {
  id: string;
  order_number: string;
  order_type: string;
  status: string;
  payment_status: string;
  payment_method: string;
  total: number;
  customer_name: string;
  customer_phone: string | null;
  created_at: string;
  outlet_name: string;
}

interface SubRow {
  id: string;
  plan_type: PlanType;
  status: SubStatus;
  period_months: number;
  expires_at: string | null;
  current_period_end: string | null;
  created_at: string;
}

interface PaymentBundle {
  subscription_payments: Array<{
    id: string;
    plan_type: string;
    status: string;
    period_months: number;
    razorpay_order_id: string | null;
    razorpay_payment_id: string | null;
    created_at: string;
  }>;
  order_payments: Array<{
    id: string;
    status: string;
    payment_method: string;
    customer_reference: string | null;
    amount: number | null;
    created_at: string;
    order_number: string;
    order_total: number;
    order_payment_status: string;
  }>;
}

interface AuditRow {
  id: string;
  admin_email: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export default function CmsCustomerDetail() {
  const { userId = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubRow[]>([]);
  const [payments, setPayments] = useState<PaymentBundle | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    business_type: "",
    account_status: "pending" as AccountStatus,
    onboarding_completed: false,
  });
  const [featureOverrides, setFeatureOverrides] = useState<FeatureOverrides>({});
  const [subDrafts, setSubDrafts] = useState<Record<string, { plan_type: PlanType; status: SubStatus }>>({});

  const loadAll = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [overviewRes, ordersRes, subsRes, paymentsRes, auditRes] = await Promise.all([
        fetch(`${API_URL}/api/cms/customers/${userId}/overview`, { credentials: "include" }),
        fetch(`${API_URL}/api/cms/customers/${userId}/orders?limit=100`, { credentials: "include" }),
        fetch(`${API_URL}/api/cms/customers/${userId}/subscriptions`, { credentials: "include" }),
        fetch(`${API_URL}/api/cms/customers/${userId}/payments`, { credentials: "include" }),
        fetch(`${API_URL}/api/cms/customers/${userId}/audit`, { credentials: "include" }),
      ]);

      const overviewData = await overviewRes.json();
      if (!overviewRes.ok) throw new Error(overviewData.error || "Failed to load customer");
      setOverview(overviewData);
      setForm({
        full_name: overviewData.profile.full_name || "",
        phone: overviewData.profile.phone || "",
        business_type: overviewData.profile.business_type || "",
        account_status: overviewData.profile.account_status,
        onboarding_completed: !!overviewData.profile.onboarding_completed,
      });

      const ordersData = await ordersRes.json();
      setOrders(ordersData.orders || []);
      const subsData = await subsRes.json();
      setSubscriptions(subsData.subscriptions || []);
      setFeatureOverrides(overviewData.access?.feature_overrides ?? {});
      const drafts: Record<string, { plan_type: PlanType; status: SubStatus }> = {};
      for (const s of subsData.subscriptions || []) {
        drafts[s.id] = { plan_type: s.plan_type, status: s.status };
      }
      setSubDrafts(drafts);
      const paymentData = await paymentsRes.json();
      setPayments(paymentData);
      const auditData = await auditRes.json();
      setAudit(auditData.audit || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load customer detail");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const totalOrderValue = useMemo(
    () => orders.reduce((sum, o) => sum + Number(o.total || 0), 0),
    [orders]
  );

  const saveProfile = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/cms/customers/${userId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      toast.success("Customer profile updated");
      await loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const saveSubscriptionRow = async (sub: SubRow) => {
    if (!userId) return;
    const draft = subDrafts[sub.id];
    if (!draft) return;
    setSaving(true);
    try {
      const [subRes, featRes] = await Promise.all([
        fetch(`${API_URL}/api/cms/subscriptions/${sub.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ plan_type: draft.plan_type, status: draft.status }),
        }),
        fetch(`${API_URL}/api/cms/customers/${userId}/features`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ feature_overrides: featureOverrides }),
        }),
      ]);
      const subData = await subRes.json();
      const featData = await featRes.json();
      if (!subRes.ok) throw new Error(subData.error || "Failed to update subscription");
      if (!featRes.ok) throw new Error(featData.error || "Failed to update features");
      toast.success("Subscription and features saved");
      setSubscriptions((prev) =>
        prev.map((s) => (s.id === sub.id ? { ...s, ...subData.subscription } : s))
      );
      if (featData.feature_overrides) setFeatureOverrides(featData.feature_overrides);
      await loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!overview) {
    return <p className="text-sm text-muted-foreground">Customer not found.</p>;
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2">
            <Link to="/cms/customers">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to customers
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">{overview.profile.full_name || overview.profile.email}</h1>
          <p className="text-sm text-muted-foreground">{overview.profile.email}</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          {overview.access?.is_test_account && (
            <Badge variant="outline" className="border-amber-500 text-amber-700">
              Test account
            </Badge>
          )}
          {overview.access?.is_active && !overview.access?.is_test_account && (
            <Badge variant="outline">Complimentary · {overview.access.effective_plan}</Badge>
          )}
          <Badge variant={overview.profile.account_status === "approved" ? "default" : "secondary"}>
            {overview.profile.account_status}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardDescription>Outlets</CardDescription><CardTitle>{overview.usage.outlets}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Staff</CardDescription><CardTitle>{overview.usage.staff}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Orders</CardDescription><CardTitle>{orders.length}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Order value</CardDescription><CardTitle>INR {totalOrderValue.toFixed(2)}</CardTitle></CardHeader></Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="access">Access & billing</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="menu">Menu</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer summary</CardTitle>
              <CardDescription>Core account details and latest subscription snapshot</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <p><strong>Business type:</strong> {overview.profile.business_type || "-"}</p>
              <p><strong>Phone:</strong> {overview.profile.phone || "-"}</p>
              <p><strong>Onboarding:</strong> {overview.profile.onboarding_completed ? "Completed" : "Pending"}</p>
              <p><strong>Created:</strong> {format(new Date(overview.profile.created_at), "MMM d, yyyy HH:mm")}</p>
              {overview.latest_subscription ? (
                <p>
                  <strong>Latest subscription:</strong> {overview.latest_subscription.plan_type} ·{" "}
                  {overview.latest_subscription.status}
                </p>
              ) : (
                <p><strong>Latest subscription:</strong> none</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access" className="mt-4">
          {overview.access ? (
            <CmsCustomerAccessPanel
              userId={userId}
              access={overview.access}
              onSaved={() => void loadAll()}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Access data unavailable.</p>
          )}
        </TabsContent>

        <TabsContent value="subscriptions" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Subscriptions</CardTitle><CardDescription>Select plan, status, and per-user module access</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              {subscriptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No subscriptions found.</p>
              ) : subscriptions.map((s) => {
                const draft = subDrafts[s.id] ?? { plan_type: s.plan_type, status: s.status };
                return (
                  <div key={s.id} className="border rounded-lg p-4 space-y-4">
                    <p className="text-xs text-muted-foreground">
                      Created {format(new Date(s.created_at), "MMM d, yyyy")}
                    </p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label>Plan</Label>
                        <Select
                          value={draft.plan_type}
                          onValueChange={(v) =>
                            setSubDrafts((prev) => ({
                              ...prev,
                              [s.id]: { ...draft, plan_type: v as PlanType },
                            }))
                          }
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
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
                          onValueChange={(v) =>
                            setSubDrafts((prev) => ({
                              ...prev,
                              [s.id]: { ...draft, status: v as SubStatus },
                            }))
                          }
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="trialing">Trialing</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="past_due">Past due</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <CmsFeatureToggles
                      planType={draft.plan_type}
                      overrides={featureOverrides}
                      onChange={setFeatureOverrides}
                    />
                    <Button size="sm" disabled={saving} onClick={() => void saveSubscriptionRow(s)}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                      Save plan & features
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Payments</CardTitle><CardDescription>Subscription and order payment records</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-medium text-sm mb-2">Subscription payments</p>
                {payments?.subscription_payments?.length ? (
                  <ul className="space-y-2">
                    {payments.subscription_payments.map((p) => (
                      <li key={p.id} className="text-sm border rounded p-2">
                        {p.plan_type} · {p.status} · {p.razorpay_payment_id || "no payment id"}
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-muted-foreground">No subscription payment rows.</p>}
              </div>
              <div>
                <p className="font-medium text-sm mb-2">Order payments</p>
                {payments?.order_payments?.length ? (
                  <ul className="space-y-2">
                    {payments.order_payments.map((p) => (
                      <li key={p.id} className="text-sm border rounded p-2">
                        {p.order_number} · {p.payment_method} · {p.status} · INR {Number(p.order_total).toFixed(2)}
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-muted-foreground">No order payment rows.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="menu" className="mt-4">
          <CmsCustomerMenuPanel
            userId={userId}
            initialOutlets={overview?.outlets?.map((o) => ({
              id: o.id,
              name: o.name,
              address: o.address,
              is_active: o.is_active,
            }))}
          />
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Orders</CardTitle><CardDescription>Recent order history for this owner</CardDescription></CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No orders found.</p>
              ) : (
                <div className="space-y-2">
                  {orders.map((o) => (
                    <div key={o.id} className="border rounded p-2 text-sm flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{o.order_number} · {o.outlet_name}</p>
                        <p className="text-xs text-muted-foreground">{o.order_type} · {o.status} · {o.payment_status}</p>
                      </div>
                      <p className="font-medium">INR {Number(o.total).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <Tabs defaultValue="profile" className="space-y-4">
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="outlets">Outlets</TabsTrigger>
              <TabsTrigger value="branding">Branding</TabsTrigger>
              <TabsTrigger value="subscription">Subscription</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="printers">Printers</TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>Update customer profile and account status from CMS</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1"><Label>Email</Label><Input value={overview.profile.email} disabled /></div>
                    <div className="space-y-1"><Label>Role</Label><Input value="Owner" disabled /></div>
                    <div className="space-y-1"><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm((s) => ({ ...s, full_name: e.target.value }))} /></div>
                    <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} /></div>
                    <div className="space-y-1"><Label>Business type</Label><Input value={form.business_type} onChange={(e) => setForm((s) => ({ ...s, business_type: e.target.value }))} /></div>
                    <div className="space-y-1">
                      <Label>Account status</Label>
                      <Select value={form.account_status} onValueChange={(v) => setForm((s) => ({ ...s, account_status: v as AccountStatus }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">pending</SelectItem>
                          <SelectItem value="approved">approved</SelectItem>
                          <SelectItem value="rejected">rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button onClick={() => void saveProfile()} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                    Save changes
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="outlets">
              <Card>
                <CardHeader>
                  <CardTitle>Outlets</CardTitle>
                  <CardDescription>Outlet-level footprint for this customer</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Total outlets: <strong className="text-foreground">{overview.usage.outlets}</strong>
                  </p>
                  {orders.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {[...new Set(orders.map((o) => o.outlet_name))].map((name) => (
                        <Badge key={name} variant="outline">{name}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No outlet order activity found yet.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="branding">
              <Card>
                <CardHeader>
                  <CardTitle>Branding</CardTitle>
                  <CardDescription>Brand-level metadata visible from customer profile</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p><strong>Brand name:</strong> {(overview.profile as unknown as { brand_name?: string }).brand_name || "-"}</p>
                  <p className="text-muted-foreground">
                    Full media/logo and color controls can be added to CMS in the next iteration.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="subscription">
              <Card>
                <CardHeader>
                  <CardTitle>Subscription</CardTitle>
                  <CardDescription>Plan and lifecycle controls</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {subscriptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No subscriptions found.</p>
                  ) : (
                    subscriptions.map((s) => (
                      <div key={s.id} className="border rounded-lg p-3 space-y-2">
                        <p className="text-sm font-medium">{s.plan_type} · {s.status}</p>
                        <p className="text-xs text-muted-foreground">
                          Expires: {s.expires_at ? format(new Date(s.expires_at), "MMM d, yyyy") : "-"}
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          <Button size="sm" variant="outline" onClick={() => void patchSubscription(s, { status: "active" })}>Set active</Button>
                          <Button size="sm" variant="outline" onClick={() => void patchSubscription(s, { status: "cancelled" })}>Cancel</Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications">
              <Card>
                <CardHeader>
                  <CardTitle>Notifications</CardTitle>
                  <CardDescription>Notification activity snapshot</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    Customer notification preference toggles are not yet CMS-managed.
                  </p>
                  <p>
                    Recent admin activity entries: <strong>{audit.length}</strong>
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security">
              <Card>
                <CardHeader>
                  <CardTitle>Security</CardTitle>
                  <CardDescription>Account access and safeguards</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>Account status: <strong>{form.account_status}</strong></p>
                  <p>Onboarding: <strong>{overview.profile.onboarding_completed ? "completed" : "pending"}</strong></p>
                  <p className="text-muted-foreground">
                    Session/device-level security actions can be added to CMS in a future step.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="printers">
              <Card>
                <CardHeader>
                  <CardTitle>Printers</CardTitle>
                  <CardDescription>Printer configuration visibility</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    Printer fleet settings are currently managed from the owner's account settings.
                  </p>
                  <p>Staff count for printing workflows: <strong>{overview.usage.staff}</strong></p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Audit timeline</CardTitle><CardDescription>Admin actions performed for this customer</CardDescription></CardHeader>
            <CardContent>
              {audit.length === 0 ? (
                <p className="text-sm text-muted-foreground">No audit entries.</p>
              ) : (
                <ul className="space-y-2">
                  {audit.map((a) => (
                    <li key={a.id} className="border rounded p-2 text-sm">
                      <p className="font-medium">{a.action}</p>
                      <p className="text-xs text-muted-foreground">{a.admin_email || "system"} · {format(new Date(a.created_at), "MMM d, yyyy HH:mm")}</p>
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

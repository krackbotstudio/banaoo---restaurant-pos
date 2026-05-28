import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Receipt, Search, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { API_URL } from "@/lib/api-url";
import { toast } from "sonner";

interface CmsPayment {
  id: string;
  user_id: string;
  plan_type: string;
  status: "trialing" | "active" | "past_due" | "cancelled";
  period_months: number | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  email: string;
  full_name: string | null;
}

export default function CmsPayments() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CmsPayment[]>([]);
  const [status, setStatus] = useState<"all" | "trialing" | "active" | "past_due" | "cancelled">("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set("status", status);
      if (search.trim()) qs.set("search", search.trim());
      const res = await fetch(`${API_URL}/api/cms/payments?${qs.toString()}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load payments");
      setRows(data.payments ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [status]);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Billing operations, reconciliation, and refund tooling for support and finance.
          </p>
        </div>
        <Badge variant="secondary">Phase 3</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Payment records
          </CardTitle>
          <CardDescription>Subscription payment history from Razorpay references</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger className="md:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">all</SelectItem>
                <SelectItem value="trialing">trialing</SelectItem>
                <SelectItem value="active">active</SelectItem>
                <SelectItem value="past_due">past_due</SelectItem>
                <SelectItem value="cancelled">cancelled</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative md:flex-1">
              <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                className="pl-9"
                placeholder="Search email, name, or Razorpay payment id"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={() => void load()}>
              Apply
            </Button>
          </div>

          {loading ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payment rows found for selected filters.</p>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                <div key={row.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{row.full_name || row.email}</p>
                      <p className="text-xs text-muted-foreground truncate">{row.email}</p>
                    </div>
                    <Badge variant={row.status === "active" ? "default" : "secondary"}>{row.status}</Badge>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2 text-xs text-muted-foreground">
                    <p>Plan: <span className="text-foreground font-medium">{row.plan_type}</span></p>
                    <p>Period months: <span className="text-foreground font-medium">{row.period_months ?? "-"}</span></p>
                    <p>Payment id: <span className="text-foreground font-medium">{row.razorpay_payment_id || "-"}</span></p>
                    <p>Order id: <span className="text-foreground font-medium">{row.razorpay_order_id || "-"}</span></p>
                    <p>Start: <span className="text-foreground font-medium">{row.current_period_start ? new Date(row.current_period_start).toLocaleDateString() : "-"}</span></p>
                    <p>End: <span className="text-foreground font-medium">{row.current_period_end ? new Date(row.current_period_end).toLocaleDateString() : "-"}</span></p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Next for Phase 3
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1) Add refund actions with confirmation and operator note.</p>
          <p>2) Merge order-payment history once admin-safe endpoint is added.</p>
          <p>3) Add CSV export for finance reconciliation.</p>
          <p className="inline-flex items-center gap-1"><Receipt className="h-3.5 w-3.5" /> Read-only payments timeline is now live.</p>
        </CardContent>
      </Card>
    </div>
  );
}

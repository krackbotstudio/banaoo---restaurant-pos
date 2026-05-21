import { useCallback, useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useOutlet } from "@/lib/outlet-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, X, IndianRupee, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const API_URL = import.meta.env.VITE_API_URL ?? "";

interface OrderPaymentRow {
  id: string;
  order_id: string;
  amount: number;
  status: string;
  method: string;
  customer_reference: string | null;
  upi_vpa: string | null;
  submitted_at: string | null;
  created_at: string;
  order_number: string;
  customer_name: string | null;
  customer_phone: string | null;
  order_type: string;
  table_number: string | null;
  order_total: number;
  order_payment_status: string;
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  awaiting_confirmation: "default",
  paid: "outline",
  failed: "destructive",
  cancelled: "destructive",
};

export default function Payments() {
  const { currentOutlet } = useOutlet();
  const { toast } = useToast();
  const [payments, setPayments] = useState<OrderPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "awaiting_confirmation" | "pending">("awaiting_confirmation");

  const fetchPayments = useCallback(async () => {
    if (!currentOutlet) return;
    setLoading(true);
    try {
      const q = filter === "all" ? "" : `&status=${filter}`;
      const res = await fetch(
        `${API_URL}/api/order-payments?outlet_id=${currentOutlet.id}${q}`,
        { credentials: "include" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setPayments(json.payments ?? []);
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not load payments",
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [currentOutlet, filter, toast]);

  useEffect(() => {
    void fetchPayments();
  }, [fetchPayments]);

  const handleAction = async (paymentId: string, action: "confirm" | "reject") => {
    setActingId(paymentId);
    try {
      const res = await fetch(`${API_URL}/api/order-payments/${paymentId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed");
      toast({
        title: action === "confirm" ? "Payment confirmed" : "Payment rejected",
        description: "Kitchen will see the order after confirmation.",
      });
      void fetchPayments();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setActingId(null);
    }
  };

  if (!currentOutlet) {
    return (
      <AppLayout>
        <div className="p-6 text-muted-foreground">Select an outlet first.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <IndianRupee className="h-6 w-6" />
              Payments
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Confirm customer UPI payments for {currentOutlet.name}
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={() => void fetchPayments()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {(["awaiting_confirmation", "pending", "all"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f === "awaiting_confirmation" ? "Awaiting confirm" : "Pending UPI"}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : payments.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              No payments in this filter.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {payments.map((p) => (
              <Card key={p.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-mono">{p.order_number}</CardTitle>
                    <Badge variant={statusVariant[p.status] ?? "secondary"}>{p.status.replace(/_/g, " ")}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-semibold">₹{Number(p.amount).toFixed(0)}</span>
                  </div>
                  {p.customer_name && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Customer</span>
                      <span>{p.customer_name}</span>
                    </div>
                  )}
                  {p.table_number && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Table</span>
                      <span>{p.table_number}</span>
                    </div>
                  )}
                  {p.customer_reference && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">UTR</span>
                      <span className="font-mono text-xs">{p.customer_reference}</span>
                    </div>
                  )}
                  {p.submitted_at && (
                    <p className="text-xs text-muted-foreground">
                      Submitted {format(new Date(p.submitted_at), "MMM d, h:mm a")}
                    </p>
                  )}
                  {p.status === "awaiting_confirmation" && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        disabled={actingId === p.id}
                        onClick={() => void handleAction(p.id, "confirm")}
                      >
                        {actingId === p.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-1" /> Confirm
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        disabled={actingId === p.id}
                        onClick={() => void handleAction(p.id, "reject")}
                      >
                        <X className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

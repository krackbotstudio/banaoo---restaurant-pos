import { useState } from "react";
import { Link } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import {
  CreditCard,
  FileText,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Repeat,
  Star,
  Trash2,
  Wallet,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useBillingOverview,
  type BillingInvoice,
  type PaymentMethod,
} from "@/hooks/use-billing-overview";

interface SubscriptionBillingHubProps {
  enabled: boolean;
  canManage?: boolean;
}

function formatRupee(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function statusBadge(status: string, isActive?: boolean) {
  if (isActive) {
    return (
      <Badge className="bg-green-500/15 text-green-700 border-green-500/25 hover:bg-green-500/15">
        Active
      </Badge>
    );
  }
  const s = status?.toLowerCase();
  if (s === "active") {
    return <Badge className="bg-green-500/15 text-green-700 border-green-500/25">Active</Badge>;
  }
  if (s === "cancelled" || s === "canceled") {
    return <Badge variant="secondary">Cancelled</Badge>;
  }
  if (s === "expired") {
    return <Badge variant="outline">Expired</Badge>;
  }
  return <Badge variant="outline" className="capitalize">{status || "—"}</Badge>;
}

function PaymentMethodIcon({ method }: { method: PaymentMethod }) {
  if (method.type === "upi") {
    return <Wallet className="h-4 w-4 text-primary shrink-0" />;
  }
  return <CreditCard className="h-4 w-4 text-primary shrink-0" />;
}

function methodLabel(method: PaymentMethod) {
  if (method.type === "upi") {
    return method.vpa || "UPI";
  }
  const exp =
    method.exp_month && method.exp_year
      ? ` · ${String(method.exp_month).padStart(2, "0")}/${method.exp_year}`
      : "";
  return `${method.brand} •••• ${method.last4}${exp}`;
}

export function SubscriptionBillingHub({ enabled, canManage = true }: SubscriptionBillingHubProps) {
  const {
    loading,
    settings,
    invoices,
    activeAddons,
    fetchOverview,
    updateSettings,
    addPaymentMethod,
    removePaymentMethod,
    setDefaultPaymentMethod,
  } = useBillingOverview(enabled);

  const [autoPaySaving, setAutoPaySaving] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [billingEmail, setBillingEmail] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<"card" | "upi">("card");
  const [cardBrand, setCardBrand] = useState("Visa");
  const [cardLast4, setCardLast4] = useState("");
  const [cardExpMonth, setCardExpMonth] = useState("");
  const [cardExpYear, setCardExpYear] = useState("");
  const [upiVpa, setUpiVpa] = useState("");
  const [addingMethod, setAddingMethod] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<BillingInvoice | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const paymentMethods = settings?.payment_methods ?? [];
  const activePurchases = activeAddons.filter((a) => a.is_active);
  const pastAddons = activeAddons.filter((a) => !a.is_active);

  const handleAutoPay = async (checked: boolean) => {
    if (!canManage) return;
    setAutoPaySaving(true);
    try {
      await updateSettings({ billing_auto_pay: checked });
      toast.success(checked ? "Auto pay enabled" : "Auto pay disabled");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update auto pay");
    } finally {
      setAutoPaySaving(false);
    }
  };

  const handleSaveEmail = async () => {
    if (!canManage) return;
    setEmailSaving(true);
    try {
      await updateSettings({ billing_email: billingEmail.trim() || null });
      toast.success("Billing email updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save email");
    } finally {
      setEmailSaving(false);
    }
  };

  const resetAddForm = () => {
    setCardLast4("");
    setCardExpMonth("");
    setCardExpYear("");
    setUpiVpa("");
    setAddType("card");
  };

  const handleAddMethod = async () => {
    setAddingMethod(true);
    try {
      if (addType === "card") {
        await addPaymentMethod({
          type: "card",
          brand: cardBrand,
          last4: cardLast4,
          exp_month: cardExpMonth ? Number(cardExpMonth) : undefined,
          exp_year: cardExpYear ? Number(cardExpYear) : undefined,
          is_default: paymentMethods.length === 0,
        });
      } else {
        await addPaymentMethod({
          type: "upi",
          vpa: upiVpa,
          is_default: paymentMethods.length === 0,
        });
      }
      toast.success("Payment method saved");
      setAddOpen(false);
      resetAddForm();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add payment method");
    } finally {
      setAddingMethod(false);
    }
  };

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(key);
      setTimeout(() => setCopiedId(null), 2000);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy");
    }
  };

  if (!enabled) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Payment methods + auto pay */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5 text-primary" />
              Billing & payment
            </CardTitle>
            <CardDescription>
              Save cards or UPI for faster checkout. Razorpay handles secure payment at renewal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 font-medium">
                  <Repeat className="h-4 w-4 text-primary" />
                  Auto pay
                </div>
                <p className="text-xs text-muted-foreground max-w-sm">
                  When enabled, we use your default method at renewal (requires a saved method).
                </p>
              </div>
              <Switch
                checked={!!settings?.billing_auto_pay}
                disabled={!canManage || autoPaySaving || loading}
                onCheckedChange={handleAutoPay}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="billing-email">Billing email (receipts)</Label>
              <div className="flex gap-2">
                <Input
                  id="billing-email"
                  type="email"
                  placeholder={settings?.billing_email || "you@restaurant.com"}
                  value={billingEmail || settings?.billing_email || ""}
                  onChange={(e) => setBillingEmail(e.target.value)}
                  disabled={!canManage || loading}
                />
                {canManage && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    disabled={emailSaving || loading}
                    onClick={handleSaveEmail}
                  >
                    {emailSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                )}
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Saved methods</p>
              {canManage && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  Add method
                </Button>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : paymentMethods.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4 text-center">
                No payment methods yet. Add a card or UPI ID to speed up renewals.
              </p>
            ) : (
              <ul className="space-y-2">
                {paymentMethods.map((method) => (
                  <li
                    key={method.id}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <PaymentMethodIcon method={method} />
                      <span className="text-sm font-medium truncate">{methodLabel(method)}</span>
                      {method.is_default && (
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          Default
                        </Badge>
                      )}
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0">
                        {!method.is_default && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Set as default"
                            onClick={() =>
                              setDefaultPaymentMethod(method.id).then(() =>
                                toast.success("Default payment method updated")
                              )
                            }
                          >
                            <Star className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() =>
                            removePaymentMethod(method.id).then(() =>
                              toast.success("Payment method removed")
                            )
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Add-on tracker */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5 text-primary" />
              Add-on purchases
            </CardTitle>
            <CardDescription className="flex flex-wrap items-center justify-between gap-2">
              <span>Track active and past add-on subscriptions</span>
              <Link to="/addons" className="text-primary text-sm font-medium hover:underline">
                Buy add-ons →
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : activeAddons.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                No add-on purchases yet.
              </p>
            ) : (
              <div className="space-y-4">
                {activePurchases.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Active
                    </p>
                    <ul className="space-y-2">
                      {activePurchases.map((addon) => (
                        <li
                          key={addon.id}
                          className="flex items-start justify-between gap-2 rounded-lg border border-primary/20 bg-primary/[0.04] px-3 py-2.5"
                        >
                          <div>
                            <p className="text-sm font-medium">{addon.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {addon.quantity > 1 ? `Qty ${addon.quantity} · ` : ""}
                              {addon.period_months
                                ? `${addon.period_months} mo billing`
                                : "One-time"}
                            </p>
                          </div>
                          <div className="text-right shrink-0 space-y-1">
                            {statusBadge(addon.status, addon.is_active)}
                            {addon.expires_at && (
                              <p className="text-[10px] text-muted-foreground">
                                Expires {format(new Date(addon.expires_at), "MMM d, yyyy")}
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {pastAddons.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      History
                    </p>
                    <ul className="space-y-2 max-h-40 overflow-y-auto">
                      {pastAddons.map((addon) => (
                        <li
                          key={addon.id}
                          className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                        >
                          <span className="truncate">{addon.label}</span>
                          {statusBadge(addon.status)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-primary" />
                Invoices & receipts
              </CardTitle>
              <CardDescription>Previously paid subscription and add-on charges</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={loading}
              onClick={() => void fetchOverview()}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-lg">
              No paid invoices yet. Your payment history will appear here after checkout.
            </p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={`${inv.kind}-${inv.id}`}>
                      <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{inv.description}</TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {format(new Date(inv.paid_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {inv.amount_rupees > 0 ? formatRupee(inv.amount_rupees) : "—"}
                      </TableCell>
                      <TableCell>{statusBadge(inv.status)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedInvoice(inv)}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add payment method dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetAddForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add billing method</DialogTitle>
            <DialogDescription>
              Store card or UPI details for quicker renewals. Actual charges use Razorpay secure checkout.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={addType} onValueChange={(v) => setAddType(v as "card" | "upi")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="card">Debit / Credit card</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {addType === "card" ? (
              <>
                <div className="space-y-2">
                  <Label>Card network</Label>
                  <Select value={cardBrand} onValueChange={setCardBrand}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Visa", "Mastercard", "RuPay", "Amex"].map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Last 4 digits</Label>
                  <Input
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="4242"
                    value={cardLast4}
                    onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Exp. month</Label>
                    <Input
                      inputMode="numeric"
                      placeholder="12"
                      maxLength={2}
                      value={cardExpMonth}
                      onChange={(e) => setCardExpMonth(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Exp. year</Label>
                    <Input
                      inputMode="numeric"
                      placeholder="2028"
                      maxLength={4}
                      value={cardExpYear}
                      onChange={(e) => setCardExpYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label>UPI ID</Label>
                <Input
                  placeholder="name@upi"
                  value={upiVpa}
                  onChange={(e) => setUpiVpa(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                addingMethod ||
                (addType === "card" ? cardLast4.length !== 4 : !upiVpa.trim())
              }
              onClick={() => void handleAddMethod()}
            >
              {addingMethod && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save method
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice detail dialog */}
      <Dialog open={!!selectedInvoice} onOpenChange={(o) => !o && setSelectedInvoice(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invoice details</DialogTitle>
            <DialogDescription>
              {selectedInvoice?.invoice_number}
            </DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Description</span>
                <span className="font-medium text-right max-w-[60%]">{selectedInvoice.description}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">
                  {selectedInvoice.amount_rupees > 0
                    ? formatRupee(selectedInvoice.amount_rupees)
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid</span>
                <span>
                  {format(new Date(selectedInvoice.paid_at), "PPP")}
                  <span className="text-muted-foreground text-xs block">
                    {formatDistanceToNow(new Date(selectedInvoice.paid_at), { addSuffix: true })}
                  </span>
                </span>
              </div>
              {selectedInvoice.expires_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valid until</span>
                  <span>{format(new Date(selectedInvoice.expires_at), "MMM d, yyyy")}</span>
                </div>
              )}
              <Separator />
              {selectedInvoice.razorpay_payment_id && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Payment ID</span>
                  <div className="flex items-center gap-1 font-mono text-xs">
                    <span className="truncate max-w-[140px]">{selectedInvoice.razorpay_payment_id}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() =>
                        void copyText(selectedInvoice.razorpay_payment_id!, "pay")
                      }
                    >
                      {copiedId === "pay" ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
              {selectedInvoice.razorpay_order_id && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Order ID</span>
                  <div className="flex items-center gap-1 font-mono text-xs">
                    <span className="truncate max-w-[140px]">{selectedInvoice.razorpay_order_id}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() =>
                        void copyText(selectedInvoice.razorpay_order_id!, "ord")
                      }
                    >
                      {copiedId === "ord" ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex justify-between items-center pt-1">
                <span className="text-muted-foreground">Status</span>
                {statusBadge(selectedInvoice.status)}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

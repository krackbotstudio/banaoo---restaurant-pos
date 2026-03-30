import { useState } from "react";
import { useAffiliate } from "@/hooks/use-affiliate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Wallet, ArrowUpRight, Clock, CheckCircle, Loader2 } from "lucide-react";

const MINIMUM_PAYOUT = 500;

export default function AffiliatePayouts() {
  const { payouts, stats, affiliate, loading, isApproved, requestPayout } = useAffiliate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [isRequesting, setIsRequesting] = useState(false);

  const availableBalance = stats.pendingEarnings - stats.pendingPayouts;
  const canRequestPayout = isApproved && availableBalance >= MINIMUM_PAYOUT;

  const handleRequestPayout = async () => {
    const amount = parseFloat(payoutAmount);

    if (isNaN(amount) || amount < MINIMUM_PAYOUT) {
      toast.error(`Minimum payout amount is ₹${MINIMUM_PAYOUT}`);
      return;
    }

    if (amount > availableBalance) {
      toast.error("Amount exceeds available balance");
      return;
    }

    setIsRequesting(true);
    try {
      await requestPayout(amount, paymentMethod);
      toast.success("Payout request submitted successfully!");
      setIsDialogOpen(false);
      setPayoutAmount("");
    } catch (error) {
      console.error("Error requesting payout:", error);
      toast.error("Failed to request payout");
    } finally {
      setIsRequesting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-success/10 text-success border-success/20">Completed</Badge>;
      case "processing":
        return <Badge className="bg-primary/10 text-primary border-primary/20">Processing</Badge>;
      case "requested":
        return <Badge variant="secondary">Requested</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Payouts</h1>
          <p className="text-muted-foreground">Manage your payout requests</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={!canRequestPayout}>
              <ArrowUpRight className="h-4 w-4 mr-2" />
              Request Payout
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Payout</DialogTitle>
              <DialogDescription>
                Enter the amount you'd like to withdraw. Minimum payout is ₹{MINIMUM_PAYOUT}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (₹)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder={`Min ₹${MINIMUM_PAYOUT}`}
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  min={MINIMUM_PAYOUT}
                  max={availableBalance}
                />
                <p className="text-xs text-muted-foreground">
                  Available balance: ₹{availableBalance.toFixed(2)}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Payment Method</Label>
                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="upi" id="upi" />
                    <Label htmlFor="upi" className="font-normal">UPI</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="bank_transfer" id="bank" />
                    <Label htmlFor="bank" className="font-normal">Bank Transfer</Label>
                  </div>
                </RadioGroup>
              </div>

              {(!affiliate?.payment_details?.upi_id && paymentMethod === "upi") ||
              (!affiliate?.payment_details?.account_number && paymentMethod === "bank_transfer") ? (
                <p className="text-sm text-destructive">
                  Please update your payment details in Settings before requesting a payout.
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleRequestPayout} disabled={isRequesting}>
                {isRequesting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Request Payout
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Balance Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="p-3 rounded-lg bg-primary/10">
              <Wallet className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-3xl font-bold">₹{availableBalance.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Available Balance</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="p-3 rounded-lg bg-warning/10">
              <Clock className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-3xl font-bold">₹{stats.pendingPayouts.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Pending Payouts</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {!canRequestPayout && (
        <Card className="border-muted">
          <CardContent className="py-4 text-sm text-muted-foreground">
            {!isApproved
              ? "Your affiliate account must be approved before you can request payouts."
              : `Minimum payout amount is ₹${MINIMUM_PAYOUT}. Your available balance is ₹${availableBalance.toFixed(2)}.`}
          </CardContent>
        </Card>
      )}

      {/* Payout History */}
      <Card>
        <CardHeader>
          <CardTitle>Payout History</CardTitle>
          <CardDescription>All your payout requests and their status</CardDescription>
        </CardHeader>
        <CardContent>
          {payouts.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium text-lg mb-1">No payouts yet</h3>
              <p className="text-muted-foreground text-sm">
                Your payout history will appear here
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requested</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Processed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell>
                      {new Date(payout.requested_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-medium">
                      ₹{Number(payout.amount).toFixed(2)}
                    </TableCell>
                    <TableCell className="capitalize">
                      {payout.payment_method.replace("_", " ")}
                    </TableCell>
                    <TableCell>{getStatusBadge(payout.status)}</TableCell>
                    <TableCell>
                      {payout.processed_at ? (
                        new Date(payout.processed_at).toLocaleDateString()
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

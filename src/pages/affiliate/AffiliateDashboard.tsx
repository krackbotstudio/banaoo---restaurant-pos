import { useAffiliate } from "@/hooks/use-affiliate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Users,
  DollarSign,
  TrendingUp,
  Clock,
  Copy,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { Link } from "react-router-dom";

export default function AffiliateDashboard() {
  const { affiliate, stats, loading, isApproved, isPending } = useAffiliate();

  const referralLink = affiliate
    ? `${window.location.origin}/auth?ref=${affiliate.referral_code}`
    : "";

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success("Referral link copied!");
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to your affiliate dashboard</p>
      </div>

      {/* Status Banner */}
      {isPending && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-warning" />
            <div>
              <p className="font-medium text-warning">Application Pending</p>
              <p className="text-sm text-muted-foreground">
                Your affiliate application is under review. You'll be notified once approved.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {isApproved && (
        <Card className="border-success/50 bg-success/5">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="font-medium text-success">Your Referral Link</p>
                <p className="text-sm text-muted-foreground break-all">{referralLink}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyReferralLink}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={referralLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Preview
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalReferrals}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeReferrals} active, {stats.pendingReferrals} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{stats.totalEarnings.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              ₹{stats.paidEarnings.toFixed(2)} paid out
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Earnings</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{stats.pendingEarnings.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Available for payout</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{stats.pendingPayouts.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Being processed</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button variant="outline" className="justify-start" asChild>
              <Link to="/affiliate/referrals">
                <Users className="h-4 w-4 mr-2" />
                View All Referrals
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link to="/affiliate/commissions">
                <DollarSign className="h-4 w-4 mr-2" />
                View Commissions
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link to="/affiliate/payouts">
                <TrendingUp className="h-4 w-4 mr-2" />
                Request Payout
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Affiliate Status</CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Status</span>
              <Badge
                variant={
                  affiliate?.status === "approved"
                    ? "default"
                    : affiliate?.status === "pending"
                    ? "secondary"
                    : "destructive"
                }
              >
                {affiliate?.status || "Unknown"}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Referral Code</span>
              <code className="bg-muted px-2 py-1 rounded text-sm">
                {affiliate?.referral_code || "N/A"}
              </code>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Commission Rate</span>
              <span className="font-medium">10%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Joined</span>
              <span className="text-sm">
                {affiliate?.created_at
                  ? new Date(affiliate.created_at).toLocaleDateString()
                  : "N/A"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

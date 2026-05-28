import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  Users,
  Clock,
  CreditCard,
  UserPlus,
  Smartphone,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { API_URL } from "@/lib/api-url";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCmsAuth } from "@/lib/cms-auth";

interface DashboardStats {
  total_owners: number;
  pending_approvals: number;
  active_subscriptions: number;
  pending_affiliates: number;
  mobile_app_leads: number;
}

interface RecentSignup {
  full_name: string;
  email: string;
  account_status: string;
  created_at: string;
}

const STAT_CARDS = [
  { key: "total_owners" as const, label: "Total owners", icon: Users },
  { key: "pending_approvals" as const, label: "Pending approvals", icon: Clock, highlight: true },
  { key: "active_subscriptions" as const, label: "Active subscriptions", icon: CreditCard },
  { key: "pending_affiliates" as const, label: "Pending affiliates", icon: UserPlus },
  { key: "mobile_app_leads" as const, label: "Mobile app leads", icon: Smartphone },
];

export default function CmsDashboard() {
  const { admin } = useCmsAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<RecentSignup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/cms/dashboard`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load dashboard");
        const data = await res.json();
        setStats(data.stats);
        setRecent(data.recent_signups ?? []);
      } catch {
        setStats(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Welcome back{admin?.full_name ? `, ${admin.full_name}` : ""}.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {STAT_CARDS.map(({ key, label, icon: Icon, highlight }) => (
              <Card key={key}>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {label}
                  </CardDescription>
                  <CardTitle
                    className={`text-3xl tabular-nums ${highlight && stats?.[key] ? "text-amber-600 dark:text-amber-400" : ""}`}
                  >
                    {stats?.[key] ?? "—"}
                  </CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Recent signups</CardTitle>
                  <CardDescription>Latest restaurant owner registrations</CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/cms/customers">
                    View all
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {recent.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No signups yet.</p>
                ) : (
                  <ul className="divide-y">
                    {recent.map((row, i) => (
                      <li key={i} className="flex items-center justify-between py-3 gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{row.full_name || "—"}</p>
                          <p className="text-xs text-muted-foreground truncate">{row.email}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <Badge variant={row.account_status === "pending" ? "secondary" : "outline"}>
                            {row.account_status}
                          </Badge>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {format(new Date(row.created_at), "MMM d, yyyy")}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {(stats?.pending_approvals ?? 0) > 0 && (
              <Card className="border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
                <CardHeader>
                  <CardTitle className="text-base">Action required</CardTitle>
                  <CardDescription>
                    {stats?.pending_approvals} owner account
                    {(stats?.pending_approvals ?? 0) !== 1 ? "s" : ""} awaiting approval
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild>
                    <Link to="/cms/customers">Review pending accounts</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}

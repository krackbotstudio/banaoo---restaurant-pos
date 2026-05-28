import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useOutlet } from "@/lib/outlet-context";
import { useStaffPermissions } from "@/lib/use-staff-permissions";
import { useProductTour } from "@/lib/product-tour/tour-context";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { DashboardBannerCarousel } from "@/components/dashboard/DashboardBannerCarousel";
import { DashboardQuickActions } from "@/components/dashboard/DashboardQuickActions";
import { DashboardDemoVideos } from "@/components/dashboard/DashboardDemoVideos";
import { DashboardResources } from "@/components/dashboard/DashboardResources";
import { DashboardUpdates } from "@/components/dashboard/DashboardUpdates";
import {
  Store,
  ShoppingCart,
  Users,
  TrendingUp,
  Sparkles,
  Plus,
  Loader2,
} from "lucide-react";
import { Link } from "react-router-dom";

interface DashboardStats {
  ordersToday: number;
  revenueToday: number;
  coversToday: number;
  outletsCount: number;
  menuItemsCount: number;
  pendingOrders: number;
}

interface AIInsight {
  message: string;
  action?: { label: string; href: string };
}

export default function Dashboard() {
  const { profile, user } = useAuth();
  const { currentOutlet } = useOutlet();
  const { permissions } = useStaffPermissions();
  const canAccessInsightHref = (href: string): boolean => {
    if (permissions === null) return true;
    if (!permissions) return false;
    const map: Record<string, string> = {
      "/orders/new": "orders",
      "/kitchen": "kitchen",
      "/menu": "menu",
      "/orders": "orders",
      "/outlets": "__none__",
    };
    const key = map[href];
    if (!key) return true;
    if (key === "__none__") return false;
    return permissions.includes(key);
  };
  const { checkWelcomeOnDashboard } = useProductTour();
  const [stats, setStats] = useState<DashboardStats>({
    ordersToday: 0,
    revenueToday: 0,
    coversToday: 0,
    outletsCount: 0,
    menuItemsCount: 0,
    pendingOrders: 0,
  });
  const [insight, setInsight] = useState<AIInsight | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && currentOutlet?.id) {
      fetchDashboardData();
    }
  }, [user, currentOutlet?.id]);

  useEffect(() => {
    checkWelcomeOnDashboard();
  }, [checkWelcomeOnDashboard]);

  const fetchDashboardData = async () => {
    if (!currentOutlet?.id) return;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count: menuCount } = await supabase
        .from("menu_items")
        .select("id", { count: "exact", head: true })
        .eq("outlet_id", currentOutlet.id);

      const { data: ordersData } = await supabase
        .from("orders")
        .select("id, total, status, created_at")
        .eq("outlet_id", currentOutlet.id)
        .gte("created_at", today.toISOString());

      const ordersToday = ordersData?.length || 0;
      const revenueToday = ordersData?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;
      const pendingOrders = ordersData?.filter(o => o.status === 'pending' || o.status === 'preparing').length || 0;
      const coversToday = ordersToday * 2;

      const newStats = {
        ordersToday,
        revenueToday,
        coversToday,
        outletsCount: 1,
        menuItemsCount: menuCount || 0,
        pendingOrders,
      };

      setStats(newStats);
      generateInsight(newStats);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateInsight = (data: DashboardStats) => {
    if (data.outletsCount === 0) {
      setInsight({
        message: "Get started by adding your first outlet. This will unlock order taking, kitchen display, and menu management features.",
        action: { label: "Add Your First Outlet", href: "/outlets" }
      });
    } else if (data.menuItemsCount === 0) {
      setInsight({
        message: "Your menu is empty! Add items manually or use AI Import to scan your physical menu and extract items automatically.",
        action: { label: "Set Up Your Menu", href: "/menu" }
      });
    } else if (data.pendingOrders > 0) {
      setInsight({
        message: `You have ${data.pendingOrders} order${data.pendingOrders > 1 ? 's' : ''} waiting to be prepared. Head to the kitchen display to manage them.`,
        action: { label: "View Kitchen", href: "/kitchen" }
      });
    } else if (data.ordersToday === 0 && data.menuItemsCount > 0) {
      setInsight({
        message: "Ready to take orders! Your menu is set up with " + data.menuItemsCount + " items. Start a new order to begin.",
        action: { label: "New Order", href: "/orders/new" }
      });
    } else if (data.ordersToday > 0) {
      const avgOrderValue = Math.round(data.revenueToday / data.ordersToday);
      setInsight({
        message: `Great progress today! Average order value is ₹${avgOrderValue}. Keep the momentum going!`,
        action: { label: "View Orders", href: "/orders" }
      });
    } else {
      setInsight({
        message: "Welcome to your restaurant management dashboard. Explore the quick actions below to get started.",
      });
    }
  };

  return (
    <div className="animate-fade-in">
      <DashboardBannerCarousel />

      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="space-y-1" data-tour="dashboard-welcome">
            <h1 className="text-2xl font-semibold">
              Welcome back{profile?.brand_name ? `, ${profile.brand_name}` : profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''} 👋
            </h1>
            <p className="text-muted-foreground">Here&apos;s what&apos;s happening today</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-tour="dashboard-stats">
            <StatCard
              title="Orders Today"
              value={loading ? "..." : stats.ordersToday.toString()}
              icon={ShoppingCart}
              variant="primary"
            />
            <StatCard
              title="Revenue"
              value={loading ? "..." : `₹${stats.revenueToday.toLocaleString()}`}
              icon={TrendingUp}
              variant="success"
            />
            <StatCard
              title="Covers"
              value={loading ? "..." : stats.coversToday.toString()}
              icon={Users}
              variant="accent"
            />
            <StatCard
              title="Outlets"
              value={loading ? "..." : stats.outletsCount.toString()}
              icon={Store}
              variant="purple"
            />
          </div>

          <Card
            className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5"
            data-tour="dashboard-insight"
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg gradient-warm glow-primary">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <CardTitle className="text-base font-medium">AI Insights</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">Analyzing your business...</p>
                </div>
              ) : (
                <>
                  <p className="text-muted-foreground text-sm mb-4">{insight?.message}</p>
                  {insight?.action && canAccessInsightHref(insight.action.href) && (
                    <Button asChild size="sm" className="gradient-warm text-white border-0 glow-primary hover:opacity-90 transition-opacity">
                      <Link to={insight.action.href}>
                        <Plus className="h-4 w-4 mr-1.5" />
                        {insight.action.label}
                      </Link>
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <DashboardQuickActions />

          <DashboardResources />
        </div>

        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-4 space-y-4">
            <DashboardUpdates />
            <DashboardDemoVideos />
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

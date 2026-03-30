import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { 
  ChefHat, 
  Store, 
  UtensilsCrossed, 
  ShoppingCart, 
  Users, 
  TrendingUp,
  Sparkles,
  Plus,
  ArrowRight,
  Loader2
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
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: outlets } = await supabase
        .from("outlets")
        .select("id")
        .eq("owner_id", user?.id);

      const outletIds = outlets?.map(o => o.id) || [];

      const { count: menuCount } = await supabase
        .from("menu_items")
        .select("id", { count: "exact", head: true })
        .in("outlet_id", outletIds.length > 0 ? outletIds : ['']);

      const { data: ordersData } = await supabase
        .from("orders")
        .select("id, total, status, created_at")
        .in("outlet_id", outletIds.length > 0 ? outletIds : [''])
        .gte("created_at", today.toISOString());

      const ordersToday = ordersData?.length || 0;
      const revenueToday = ordersData?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;
      const pendingOrders = ordersData?.filter(o => o.status === 'pending' || o.status === 'preparing').length || 0;
      const coversToday = ordersToday * 2;

      const newStats = {
        ordersToday,
        revenueToday,
        coversToday,
        outletsCount: outlets?.length || 0,
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

  const quickActions = [
    { 
      title: "New Order", 
      description: "Take dine-in or takeaway orders",
      icon: ShoppingCart, 
      href: "/orders/new",
      color: "primary"
    },
    { 
      title: "Kitchen Display", 
      description: "View live order queue",
      icon: ChefHat, 
      href: "/kitchen",
      color: "accent"
    },
    { 
      title: "Menu", 
      description: "Manage items & categories",
      icon: UtensilsCrossed, 
      href: "/menu",
      color: "success"
    },
    { 
      title: "Outlets", 
      description: "Manage your restaurants",
      icon: Store, 
      href: "/outlets",
      color: "purple"
    },
  ];

  const colorMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary group-hover:bg-primary/15",
    accent: "bg-accent/10 text-accent group-hover:bg-accent/15",
    success: "bg-success/10 text-success group-hover:bg-success/15",
    purple: "bg-purple-500/10 text-purple-500 group-hover:bg-purple-500/15",
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto animate-fade-in">
      {/* Welcome Section */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">
          Welcome back{profile?.brand_name ? `, ${profile.brand_name}` : profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''} 👋
        </h1>
        <p className="text-muted-foreground">Here's what's happening today</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* AI Insight Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
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
              {insight?.action && (
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

      {/* Quick Actions */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <Link key={action.title} to={action.href}>
              <Card className="h-full group hover:shadow-elevated hover:-translate-y-0.5 transition-all cursor-pointer border-border hover:border-primary/30">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className={`p-2.5 rounded-lg mb-3 w-fit transition-colors ${colorMap[action.color]}`}>
                        <action.icon className="h-5 w-5" />
                      </div>
                      <CardTitle className="text-sm font-medium group-hover:text-primary transition-colors">{action.title}</CardTitle>
                      <CardDescription className="text-xs">{action.description}</CardDescription>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

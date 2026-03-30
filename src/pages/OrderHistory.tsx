import { useState, useEffect, useMemo, Fragment } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Loader2, Search, ShoppingBag, TrendingUp, XCircle, ChevronDown, ChevronUp, Download, IndianRupee } from "lucide-react";

interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Order {
  id: string;
  order_number: string;
  outlet_id: string;
  outlet_name: string;
  status: string;
  order_type: string;
  source: string;
  table_number: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  total: number;
  created_at: string;
  order_items: OrderItem[];
}

const getDateStart = (period: string) => {
  const d = new Date();
  if (period === "today") d.setHours(0, 0, 0, 0);
  else if (period === "week") d.setDate(d.getDate() - 7);
  else if (period === "month") d.setDate(d.getDate() - 30);
  else d.setDate(d.getDate() - 90);
  return d.toISOString();
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30",
  preparing: "bg-blue-500/20 text-blue-600 border-blue-500/30",
  ready: "bg-green-500/20 text-green-600 border-green-500/30",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-red-500/20 text-red-600 border-red-500/30",
};

export default function OrderHistory() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [outlets, setOutlets] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("month");
  const [outletFilter, setOutletFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchData();
  }, [user, period]);

  const fetchData = async () => {
    setLoading(true);
    const { data: outletData } = await supabase
      .from("outlets")
      .select("id, name")
      .eq("owner_id", user!.id)
      .order("name");

    if (!outletData?.length) { setLoading(false); return; }

    setOutlets(outletData);
    const outletIds = outletData.map((o) => o.id);
    const outletMap = Object.fromEntries(outletData.map((o) => [o.id, o.name]));

    const { data } = await supabase
      .from("orders")
      .select("id, order_number, outlet_id, status, order_type, source, table_number, customer_name, customer_phone, total, created_at, order_items(id, item_name, quantity, unit_price, total_price)")
      .in("outlet_id", outletIds)
      .gte("created_at", getDateStart(period))
      .order("created_at", { ascending: false });

    setOrders(
      (data || []).map((o) => ({
        ...o,
        outlet_name: outletMap[o.outlet_id] || "",
        order_items: (o.order_items || []) as OrderItem[],
      })) as Order[]
    );
    setLoading(false);
  };

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (outletFilter !== "all" && o.outlet_id !== outletFilter) return false;
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (sourceFilter !== "all" && o.source !== sourceFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          o.order_number.toLowerCase().includes(q) ||
          (o.customer_name?.toLowerCase().includes(q) ?? false) ||
          (o.customer_phone?.includes(q) ?? false)
        );
      }
      return true;
    });
  }, [orders, outletFilter, statusFilter, sourceFilter, search]);

  const stats = useMemo(() => {
    const nonCancelled = filtered.filter((o) => o.status !== "cancelled");
    const revenue = nonCancelled.reduce((s, o) => s + (o.total || 0), 0);
    return {
      total: filtered.length,
      revenue,
      avg: nonCancelled.length ? revenue / nonCancelled.length : 0,
      cancelled: filtered.filter((o) => o.status === "cancelled").length,
    };
  }, [filtered]);

  const exportCSV = () => {
    const rows = [
      ["Order #", "Date", "Outlet", "Status", "Type", "Source", "Customer", "Phone", "Total"],
      ...filtered.map((o) => [
        o.order_number,
        new Date(o.created_at).toLocaleString(),
        o.outlet_name,
        o.status,
        o.order_type,
        o.source,
        o.customer_name || "",
        o.customer_phone || "",
        o.total.toString(),
      ]),
    ];
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `orders-${period}.csv`;
    a.click();
  };

  const fmtCurrency = (v: number) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  const fmtTime = (s: string) =>
    new Date(s).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl gradient-primary glow-primary">
              <ShoppingBag className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">Order History</h1>
              <p className="text-sm text-muted-foreground">Detailed order records across all outlets</p>
            </div>
          </div>
          <Button variant="outline" onClick={exportCSV} className="gap-2">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Orders", value: stats.total, icon: ShoppingBag, color: "text-primary" },
            { label: "Revenue", value: fmtCurrency(stats.revenue), icon: IndianRupee, color: "text-green-600" },
            { label: "Avg Order Value", value: fmtCurrency(stats.avg), icon: TrendingUp, color: "text-blue-600" },
            { label: "Cancelled", value: stats.cancelled, icon: XCircle, color: "text-red-500" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <s.icon className={`h-5 w-5 shrink-0 ${s.color}`} />
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-xl font-bold">{s.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={period} onValueChange={(v) => { setPeriod(v); }}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 days</SelectItem>
              <SelectItem value="month">Last 30 days</SelectItem>
              <SelectItem value="quarter">Last 90 days</SelectItem>
            </SelectContent>
          </Select>

          {outlets.length > 1 && (
            <Select value={outletFilter} onValueChange={setOutletFilter}>
              <SelectTrigger className="w-40 h-9"><SelectValue placeholder="All Outlets" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Outlets</SelectItem>
                {outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9"><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {["pending", "preparing", "ready", "completed", "cancelled"].map((s) => (
                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-36 h-9"><SelectValue placeholder="All Sources" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {["pos", "zomato", "swiggy", "website"].map((s) => (
                <SelectItem key={s} value={s}>{s === "pos" ? "POS" : s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search order # or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="No orders found"
            description="Try adjusting your filters or date range"
          />
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Order</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Date & Time</th>
                  {outlets.length > 1 && (
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Outlet</th>
                  )}
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Customer</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                  <th className="w-8 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((order) => (
                  <Fragment key={order.id}>
                    <tr
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">#{order.order_number}</div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {order.order_type === "dine_in" ? `Table ${order.table_number}` : order.order_type}
                          {" · "}{order.source === "pos" ? "POS" : order.source}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                        <div>{fmtDate(order.created_at)}</div>
                        <div className="text-xs">{fmtTime(order.created_at)}</div>
                      </td>
                      {outlets.length > 1 && (
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{order.outlet_name}</td>
                      )}
                      <td className="px-4 py-3 hidden md:table-cell">
                        {order.customer_name ? (
                          <div>
                            <div className="font-medium">{order.customer_name}</div>
                            <div className="text-xs text-muted-foreground">{order.customer_phone}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Walk-in</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`capitalize text-xs ${STATUS_COLOR[order.status] || ""}`}>
                          {order.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{fmtCurrency(order.total)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {expandedId === order.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </td>
                    </tr>

                    {expandedId === order.id && (
                      <tr className="bg-muted/20">
                        <td colSpan={outlets.length > 1 ? 7 : 6} className="px-6 py-4">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Items</p>
                          <div className="space-y-1.5 max-w-md">
                            {order.order_items.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No item details available</p>
                            ) : (
                              <>
                                {order.order_items.map((item) => (
                                  <div key={item.id} className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">
                                      {item.quantity}× {item.item_name}
                                    </span>
                                    <span className="font-medium">{fmtCurrency(item.total_price)}</span>
                                  </div>
                                ))}
                                <div className="flex justify-between font-semibold border-t pt-2 mt-2 text-sm">
                                  <span>Total</span>
                                  <span>{fmtCurrency(order.total)}</span>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 bg-muted/30 border-t text-xs text-muted-foreground">
              Showing {filtered.length} of {orders.length} orders
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

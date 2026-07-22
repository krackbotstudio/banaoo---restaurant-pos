import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useOutlet } from "@/lib/outlet-context";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp, IndianRupee, ShoppingBag, Users, Award, BarChart2, Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const PIE_COLORS = ["#FF4500", "#3b82f6", "#22c55e", "#a855f7", "#ef4444", "#F89800"];

const fmtCurrency = (v: number) =>
  `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const fmtShort = (v: number) =>
  v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${(v / 1000).toFixed(1)}K` : `₹${v}`;

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Analytics() {
  const { user } = useAuth();
  const { currentOutlet } = useOutlet();
  const [orders, setOrders] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30");

  useEffect(() => {
    if (user && currentOutlet?.id) fetchData();
  }, [user, currentOutlet?.id, period]);

  const fetchData = async () => {
    if (!currentOutlet?.id) return;
    setLoading(true);
    const start = new Date();
    start.setDate(start.getDate() - parseInt(period));

    const { data: orderData } = await supabase
      .from("orders")
      .select("id, outlet_id, status, order_type, source, total, created_at, customer_phone")
      .eq("outlet_id", currentOutlet.id)
      .gte("created_at", start.toISOString())
      .neq("status", "cancelled")
      .order("created_at")
      .limit(20000);

    const orderIds = (orderData || []).map((o) => o.id);
    let itemData: any[] = [];
    if (orderIds.length > 0) {
      // Chunk to avoid Supabase IN() limits on very long lists.
      const CHUNK = 800;
      for (let i = 0; i < orderIds.length; i += CHUNK) {
        const slice = orderIds.slice(i, i + CHUNK);
        const { data } = await supabase
          .from("order_items")
          .select("item_name, quantity, total_price, order_id")
          .in("order_id", slice);
        if (data) itemData = itemData.concat(data);
      }
    }

    setOrders(orderData || []);
    setOrderItems(itemData);
    setLoading(false);
  };

  const filteredOrders = orders;
  const filteredItems = orderItems;

  // Revenue & orders bucketed by day (≤90d) or week (>90d) for readability.
  const periodDays = parseInt(period);
  const bucketBy: "day" | "week" = periodDays > 90 ? "week" : "day";

  const dailyData = useMemo(() => {
    const map = new Map<string, { date: string; revenue: number; orders: number }>();

    const startOfWeek = (d: Date) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      const day = x.getDay(); // 0=Sun
      const diff = (day + 6) % 7; // Monday start
      x.setDate(x.getDate() - diff);
      return x;
    };

    if (bucketBy === "day") {
      for (let i = periodDays - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
        map.set(key, { date: label, revenue: 0, orders: 0 });
      }
      for (const o of filteredOrders) {
        const key = o.created_at.slice(0, 10);
        if (map.has(key)) {
          map.get(key)!.revenue += o.total || 0;
          map.get(key)!.orders += 1;
        }
      }
    } else {
      // Weekly buckets keyed by Monday's ISO date.
      const today = new Date();
      const earliest = startOfWeek(new Date(today.getTime() - (periodDays - 1) * 86400000));
      for (let d = new Date(earliest); d <= today; d.setDate(d.getDate() + 7)) {
        const key = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
        map.set(key, { date: label, revenue: 0, orders: 0 });
      }
      for (const o of filteredOrders) {
        const wk = startOfWeek(new Date(o.created_at));
        const key = wk.toISOString().slice(0, 10);
        if (map.has(key)) {
          map.get(key)!.revenue += o.total || 0;
          map.get(key)!.orders += 1;
        }
      }
    }
    return Array.from(map.values());
  }, [filteredOrders, periodDays, bucketBy]);

  // Top items
  const topItems = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const item of filteredItems) {
      if (!map.has(item.item_name)) {
        map.set(item.item_name, { name: item.item_name, qty: 0, revenue: 0 });
      }
      const r = map.get(item.item_name)!;
      r.qty += item.quantity || 1;
      r.revenue += item.total_price || 0;
    }
    return Array.from(map.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8);
  }, [filteredItems]);

  // Order type breakdown
  const typeData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of filteredOrders) {
      const t = o.order_type || "unknown";
      counts[t] = (counts[t] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({
      name: name === "dine_in" ? "Dine In" : name === "takeaway" ? "Takeaway" : "Delivery",
      value,
    }));
  }, [filteredOrders]);

  // Source breakdown
  const sourceData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of filteredOrders) {
      const s = o.source || "pos";
      counts[s] = (counts[s] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({
      name: name === "pos" ? "POS" : name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));
  }, [filteredOrders]);

  // KPIs
  const kpis = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((s, o) => s + (o.total || 0), 0);
    const totalOrders = filteredOrders.length;
    const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0;
    const uniqueCustomers = new Set(filteredOrders.filter((o) => o.customer_phone).map((o) => o.customer_phone)).size;
    const bestDay = dailyData.reduce((best, d) => (d.revenue > best.revenue ? d : best), { date: "—", revenue: 0 });
    return { totalRevenue, totalOrders, avgOrderValue, uniqueCustomers, bestDay };
  }, [filteredOrders, dailyData]);

  // ─── CSV export ────────────────────────────────────────────────────────────
  const outletSlug = (currentOutlet?.name || "outlet").replace(/[^a-zA-Z0-9]+/g, "_").toLowerCase();

  const exportOrdersCsv = () => {
    if (filteredOrders.length === 0) {
      toast.message("Nothing to export", { description: "No orders in this period." });
      return;
    }
    const rows = filteredOrders.map((o) => ({
      order_id: o.id,
      created_at: new Date(o.created_at).toLocaleString("en-IN"),
      status: o.status ?? "",
      order_type: o.order_type ?? "",
      source: o.source ?? "",
      customer_phone: o.customer_phone ?? "",
      total_inr: Number(o.total ?? 0).toFixed(2),
    }));
    downloadCsv(`flaze_orders_${outletSlug}_${period}d.csv`, toCsv(rows));
    toast.success(`Exported ${rows.length} orders`);
  };

  const exportItemsCsv = () => {
    if (filteredItems.length === 0) {
      toast.message("Nothing to export", { description: "No items in this period." });
      return;
    }
    const orderMap = new Map(filteredOrders.map((o) => [o.id, o]));
    const rows = filteredItems
      .filter((it) => orderMap.has(it.order_id))
      .map((it) => {
        const o = orderMap.get(it.order_id);
        return {
          order_id: it.order_id,
          created_at: o ? new Date(o.created_at).toLocaleString("en-IN") : "",
          item_name: it.item_name ?? "",
          quantity: it.quantity ?? 0,
          total_price_inr: Number(it.total_price ?? 0).toFixed(2),
        };
      });
    downloadCsv(`flaze_items_${outletSlug}_${period}d.csv`, toCsv(rows));
    toast.success(`Exported ${rows.length} order items`);
  };

  const exportSummaryCsv = () => {
    const rows = [
      { metric: "Outlet", value: currentOutlet?.name ?? "" },
      { metric: "Period (days)", value: period },
      { metric: "Generated", value: new Date().toLocaleString("en-IN") },
      { metric: "Total Revenue (INR)", value: kpis.totalRevenue.toFixed(2) },
      { metric: "Total Orders", value: kpis.totalOrders },
      { metric: "Avg Order Value (INR)", value: kpis.avgOrderValue.toFixed(2) },
      { metric: "Unique Customers", value: kpis.uniqueCustomers },
      { metric: `Best ${bucketBy === "week" ? "Week" : "Day"}`, value: `${kpis.bestDay.date} (₹${Math.round(kpis.bestDay.revenue)})` },
      ...topItems.map((it, i) => ({ metric: `Top Item #${i + 1}`, value: `${it.name} — ${it.qty} sold (₹${Math.round(it.revenue)})` })),
    ];
    downloadCsv(`flaze_summary_${outletSlug}_${period}d.csv`, toCsv(rows));
    toast.success("Exported summary");
  };


  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl gradient-primary glow-primary">
              <BarChart2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">Analytics</h1>
              <p className="text-sm text-muted-foreground">{currentOutlet?.name}</p>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="flex gap-1 flex-wrap">
              {[
                { label: "7D", value: "7" },
                { label: "30D", value: "30" },
                { label: "90D", value: "90" },
                { label: "6M", value: "180" },
                { label: "1Y", value: "365" },
              ].map((p) => (
                <Button
                  key={p.value}
                  size="sm"
                  variant={period === p.value ? "default" : "outline"}
                  onClick={() => setPeriod(p.value)}
                  className="w-12"
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Download as CSV</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={exportSummaryCsv}>
                  Summary (KPIs + top items)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportOrdersCsv}>
                  Orders ({filteredOrders.length})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportItemsCsv}>
                  Order items ({filteredItems.length})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Revenue", value: fmtCurrency(kpis.totalRevenue), icon: IndianRupee, color: "text-green-600", sub: `${kpis.totalOrders} orders` },
            { label: "Avg Order Value", value: fmtCurrency(kpis.avgOrderValue), icon: TrendingUp, color: "text-blue-600" },
            { label: "Unique Customers", value: kpis.uniqueCustomers, icon: Users, color: "text-purple-600" },
            { label: "Best Day", value: kpis.bestDay.date, icon: Award, color: "text-amber-500", sub: fmtCurrency(kpis.bestDay.revenue) },
          ].map((k) => (
            <Card key={k.label}>
              <CardContent className="pt-5">
                <div className="flex items-start gap-3">
                  <k.icon className={`h-5 w-5 shrink-0 mt-0.5 ${k.color}`} />
                  <div>
                    <p className="text-xs text-muted-foreground">{k.label}</p>
                    <p className="text-xl font-bold">{k.value}</p>
                    {"sub" in k && k.sub && <p className="text-xs text-muted-foreground">{k.sub}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Revenue & Orders Trend
              {bucketBy === "week" ? (
                <span className="ml-2 text-xs font-normal text-muted-foreground">(weekly buckets)</span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={dailyData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  interval={
                    period === "7"
                      ? 0
                      : period === "30"
                      ? 4
                      : period === "90"
                      ? 9
                      : period === "180"
                      ? 2 // ~26 weekly buckets → show ~9 labels
                      : 4 // 1Y, ~52 weekly buckets → show ~10 labels
                  }
                />
                <YAxis yAxisId="rev" tickFormatter={fmtShort} tick={{ fontSize: 11 }} width={55} />
                <YAxis yAxisId="ord" orientation="right" tick={{ fontSize: 11 }} width={30} />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name === "Revenue" ? fmtCurrency(value) : value
                  }
                />
                <Legend />
                <Line
                  yAxisId="rev"
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="#FF4500"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  yAxisId="ord"
                  type="monotone"
                  dataKey="orders"
                  name="Orders"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Top Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                Top Selling Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topItems.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No item data available</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={topItems}
                    layout="vertical"
                    margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} className="opacity-30" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      width={110}
                      tickFormatter={(v) => v.length > 14 ? v.slice(0, 14) + "…" : v}
                    />
                    <Tooltip formatter={(v: number) => [`${v} sold`, "Quantity"]} />
                    <Bar dataKey="qty" name="Qty Sold" fill="#FF4500" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Breakdown charts */}
          <div className="space-y-6">
            {/* Order Type */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Order Type Split</CardTitle>
              </CardHeader>
              <CardContent>
                {typeData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No data</p>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width={120} height={120}>
                      <PieChart>
                        <Pie data={typeData} cx="50%" cy="50%" innerRadius={30} outerRadius={55} dataKey="value">
                          {typeData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => [`${v} orders`]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2 flex-1">
                      {typeData.map((d, i) => {
                        const total = typeData.reduce((s, x) => s + x.value, 0);
                        return (
                          <div key={d.name} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                              <span className="text-muted-foreground">{d.name}</span>
                            </div>
                            <div className="font-medium">
                              {d.value} <span className="text-muted-foreground text-xs">({Math.round((d.value / total) * 100)}%)</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Source */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Order Source Split</CardTitle>
              </CardHeader>
              <CardContent>
                {sourceData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No data</p>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width={120} height={120}>
                      <PieChart>
                        <Pie data={sourceData} cx="50%" cy="50%" innerRadius={30} outerRadius={55} dataKey="value">
                          {sourceData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => [`${v} orders`]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2 flex-1">
                      {sourceData.map((d, i) => {
                        const total = sourceData.reduce((s, x) => s + x.value, 0);
                        return (
                          <div key={d.name} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                              <span className="text-muted-foreground">{d.name}</span>
                            </div>
                            <div className="font-medium">
                              {d.value} <span className="text-muted-foreground text-xs">({Math.round((d.value / total) * 100)}%)</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}

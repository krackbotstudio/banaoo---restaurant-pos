import { useState, useEffect, useMemo, Fragment } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useOutlet } from "@/lib/outlet-context";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Users, IndianRupee, Star, ChevronDown, ChevronUp, Send, Phone, ShoppingBag } from "lucide-react";

interface CustomerRecord {
  phone: string;
  name: string;
  orders: number;
  totalSpent: number;
  avgOrder: number;
  lastOrder: string;
  isRepeat: boolean;
  orderHistory: {
    id: string;
    order_number: string;
    total: number;
    status: string;
    created_at: string;
    outlet_name: string;
  }[];
}

export default function Customers() {
  const { user } = useAuth();
  const { currentOutlet } = useOutlet();
  const { toast } = useToast();
  const [rawOrders, setRawOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"lastOrder" | "orders" | "spent">("lastOrder");
  const [expandedPhone, setExpandedPhone] = useState<string | null>(null);

  useEffect(() => {
    if (user && currentOutlet?.id) fetchOrders();
  }, [user, currentOutlet?.id]);

  const fetchOrders = async () => {
    if (!currentOutlet?.id) return;
    setLoading(true);

    const { data } = await supabase
      .from("orders")
      .select("id, order_number, outlet_id, customer_name, customer_phone, total, status, created_at")
      .eq("outlet_id", currentOutlet.id)
      .not("customer_phone", "is", null)
      .order("created_at", { ascending: false });

    setRawOrders((data || []).map((o) => ({ ...o, outlet_name: currentOutlet.name })));
    setLoading(false);
  };

  const customers = useMemo<CustomerRecord[]>(() => {
    const map = new Map<string, CustomerRecord>();
    for (const o of rawOrders) {
      const phone = o.customer_phone;
      if (!phone) continue;
      if (!map.has(phone)) {
        map.set(phone, {
          phone,
          name: o.customer_name || phone,
          orders: 0,
          totalSpent: 0,
          avgOrder: 0,
          lastOrder: o.created_at,
          isRepeat: false,
          orderHistory: [],
        });
      }
      const c = map.get(phone)!;
      c.orders += 1;
      c.totalSpent += o.total || 0;
      if (o.created_at > c.lastOrder) {
        c.lastOrder = o.created_at;
        if (o.customer_name) c.name = o.customer_name;
      }
      c.orderHistory.push({
        id: o.id,
        order_number: o.order_number,
        total: o.total,
        status: o.status,
        created_at: o.created_at,
        outlet_name: o.outlet_name,
      });
    }
    return Array.from(map.values()).map((c) => ({
      ...c,
      avgOrder: c.orders ? c.totalSpent / c.orders : 0,
      isRepeat: c.orders > 1,
    }));
  }, [rawOrders]);

  const filtered = useMemo(() => {
    let list = customers;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q));
    }
    return [...list].sort((a, b) => {
      if (sortBy === "orders") return b.orders - a.orders;
      if (sortBy === "spent") return b.totalSpent - a.totalSpent;
      return b.lastOrder.localeCompare(a.lastOrder);
    });
  }, [customers, search, sortBy]);

  const stats = useMemo(() => ({
    total: customers.length,
    repeat: customers.filter((c) => c.isRepeat).length,
    avgSpend: customers.length
      ? customers.reduce((s, c) => s + c.totalSpent, 0) / customers.length
      : 0,
  }), [customers]);

  const fmtCurrency = (v: number) =>
    `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const STATUS_COLOR: Record<string, string> = {
    completed: "text-green-600",
    cancelled: "text-red-500",
    pending: "text-yellow-600",
    preparing: "text-blue-600",
    ready: "text-green-600",
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl gradient-primary glow-primary">
              <Users className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">Customers</h1>
              <p className="text-sm text-muted-foreground">Customer database from your order history</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() =>
              toast({ title: "Coming Soon", description: "Bulk offer messaging will be available soon." })
            }
          >
            <Send className="h-4 w-4" /> Send Offer
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Total Customers", value: stats.total, icon: Users, color: "text-primary" },
            { label: "Repeat Customers", value: stats.repeat, icon: Star, color: "text-amber-500",
              sub: stats.total ? `${Math.round((stats.repeat / stats.total) * 100)}% retention` : "" },
            { label: "Avg Lifetime Spend", value: fmtCurrency(stats.avgSpend), icon: IndianRupee, color: "text-green-600" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-5">
                <div className="flex items-start gap-3">
                  <s.icon className={`h-5 w-5 shrink-0 mt-0.5 ${s.color}`} />
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-xl font-bold">{s.value}</p>
                    {"sub" in s && s.sub && <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <div className="flex gap-2">
            {[
              { key: "lastOrder", label: "Recent" },
              { key: "orders", label: "Most Orders" },
              { key: "spent", label: "Top Spenders" },
            ].map((s) => (
              <Button
                key={s.key}
                variant={sortBy === s.key ? "secondary" : "outline"}
                size="sm"
                onClick={() => setSortBy(s.key as typeof sortBy)}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No customers yet"
            description="Customers who order online with their phone number will appear here automatically."
          />
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Phone</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Orders</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total Spent</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Avg Order</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Last Visit</th>
                  <th className="w-8 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((customer) => (
                  <Fragment key={customer.phone}>
                    <tr
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() =>
                        setExpandedPhone(expandedPhone === customer.phone ? null : customer.phone)
                      }
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{customer.name}</div>
                        {customer.isRepeat && (
                          <div className="flex items-center gap-1 text-xs text-amber-600 mt-0.5">
                            <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                            Repeat customer
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          {customer.phone}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">{customer.orders}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-primary">
                        {fmtCurrency(customer.totalSpent)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">
                        {fmtCurrency(customer.avgOrder)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground text-xs hidden lg:table-cell">
                        {fmtDate(customer.lastOrder)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {expandedPhone === customer.phone ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </td>
                    </tr>

                    {expandedPhone === customer.phone && (
                      <tr className="bg-muted/20">
                        <td colSpan={7} className="px-6 py-4">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                            Order History
                          </p>
                          <div className="space-y-2 max-w-lg">
                            {customer.orderHistory.map((o) => (
                              <div key={o.id} className="flex items-center justify-between text-sm">
                                <div className="text-muted-foreground">
                                  <span className="font-medium text-foreground">#{o.order_number}</span>
                                  {" · "}{o.outlet_name}
                                  {" · "}{fmtDate(o.created_at)}
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className={`text-xs capitalize ${STATUS_COLOR[o.status] || ""}`}>
                                    {o.status}
                                  </span>
                                  <span className="font-medium">{fmtCurrency(o.total)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 bg-muted/30 border-t text-xs text-muted-foreground">
              {filtered.length} customers · {stats.repeat} repeat
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

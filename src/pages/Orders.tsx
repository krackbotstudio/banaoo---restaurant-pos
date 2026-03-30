import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOutlet } from "@/lib/outlet-context";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, ShoppingCart, Clock, CheckCircle, XCircle, ChefHat, MapPin, User } from "lucide-react";
import { PlatformBadge } from "@/components/integrations";

interface Order {
  id: string;
  order_number: string;
  status: "pending" | "preparing" | "ready" | "completed" | "cancelled";
  total: number;
  created_at: string;
  table_number: string | null;
  order_type: string;
  source: string;
  customer_name: string | null;
  delivery_address: string | null;
  order_items: { id: string }[];
}

export default function Orders() {
  const { currentOutlet, outlets, loading: outletLoading } = useOutlet();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  useEffect(() => {
    if (currentOutlet) {
      fetchOrders();
      
      // Subscribe to realtime updates
      const channel = supabase
        .channel('orders-page')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `outlet_id=eq.${currentOutlet.id}`
          },
          () => {
            fetchOrders();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentOutlet]);

  const fetchOrders = async () => {
    if (!currentOutlet) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select(`
        id,
        order_number,
        status,
        total,
        created_at,
        table_number,
        order_type,
        source,
        customer_name,
        delivery_address,
        order_items (id)
      `)
      .eq("outlet_id", currentOutlet.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setOrders(data as Order[]);
    }
    setLoading(false);
  };

  const getStatusIcon = (status: Order["status"]) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "preparing":
        return <ChefHat className="h-4 w-4" />;
      case "ready":
        return <CheckCircle className="h-4 w-4" />;
      case "completed":
        return <CheckCircle className="h-4 w-4" />;
      case "cancelled":
        return <XCircle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: Order["status"]) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500/20 text-yellow-500 border-yellow-500/30";
      case "preparing":
        return "bg-blue-500/20 text-blue-500 border-blue-500/30";
      case "ready":
        return "bg-green-500/20 text-green-500 border-green-500/30";
      case "completed":
        return "bg-muted text-muted-foreground";
      case "cancelled":
        return "bg-red-500/20 text-red-500 border-red-500/30";
    }
  };

  if (outletLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (outlets.length === 0) {
    return (
      <AppLayout>
        <div className="p-6 max-w-7xl mx-auto">
          <EmptyState
            icon={ShoppingCart}
            title="No Outlets Found"
            description="Create an outlet first before managing orders"
            actionLabel="Go to Outlets"
            onAction={() => window.location.href = "/outlets"}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl gradient-primary glow-primary">
              <ShoppingCart className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">Orders</h1>
              <p className="text-sm text-muted-foreground">
                {currentOutlet?.name ? `${currentOutlet.name} - ` : ""}Manage and track customer orders
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button asChild className="gradient-primary glow-primary h-10">
              <Link to="/orders/new">
                <Plus className="h-4 w-4 mr-2" />
                New Order
              </Link>
            </Button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="space-y-3">
          {/* Source Filter */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground self-center mr-2">Source:</span>
            {["all", "pos", "zomato", "swiggy"].map((source) => (
              <Button
                key={source}
                variant={sourceFilter === source ? "secondary" : "outline"}
                size="sm"
                className="rounded-full capitalize"
                onClick={() => setSourceFilter(source)}
              >
                {source === "all" ? "All Sources" : source.toUpperCase()}
              </Button>
            ))}
          </div>
          
          {/* Status Filter */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground self-center mr-2">Status:</span>
            {["all", "pending", "preparing", "ready", "completed"].map((status) => (
              <Button
                key={status}
                variant={filter === status ? "secondary" : "outline"}
                size="sm"
                className="rounded-full capitalize"
                onClick={() => setFilter(status)}
              >
                {status === "all" ? "All Status" : status}
              </Button>
            ))}
          </div>
        </div>

        {/* Orders List */}
        {(() => {
          let filteredOrders = orders;
          
          if (sourceFilter !== "all") {
            filteredOrders = filteredOrders.filter(o => o.source === sourceFilter);
          }
          
          if (filter !== "all") {
            filteredOrders = filteredOrders.filter(o => o.status === filter);
          }
          
          return filteredOrders.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title={filter === "all" && sourceFilter === "all" ? "No Orders Yet" : "No matching orders"}
              description="Start taking orders from your customers"
              actionLabel="Create New Order"
              onAction={() => window.location.href = "/orders/new"}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredOrders.map((order) => (
              <Card key={order.id} className={`group hover:border-primary/50 transition-all duration-300 cursor-pointer ${
                order.source === 'zomato' ? 'border-l-4 border-l-red-500' : 
                order.source === 'swiggy' ? 'border-l-4 border-l-orange-500' : ''
              }`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="font-display text-lg">#{order.order_number}</CardTitle>
                        {order.source !== 'pos' && <PlatformBadge source={order.source} />}
                      </div>
                      <CardDescription className="text-xs mt-1">
                        {order.order_type === "dine_in" ? `Table ${order.table_number}` : 
                         order.order_type === "delivery" ? "Delivery" : "Takeaway"}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className={`${getStatusColor(order.status)} flex items-center gap-1.5`}>
                      {getStatusIcon(order.status)}
                      <span className="capitalize">{order.status}</span>
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Customer info for delivery orders */}
                  {order.source !== 'pos' && order.customer_name && (
                    <div className="mb-3 p-2 rounded-lg bg-muted/50 space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="truncate">{order.customer_name}</span>
                      </div>
                      {order.delivery_address && (
                        <div className="flex items-start gap-2 text-xs text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{order.delivery_address}</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {order.order_items.length} items
                    </div>
                    <div className="text-lg font-bold text-primary">₹{order.total}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        );
        })()}
      </div>
    </AppLayout>
  );
}
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TableCard } from "./TableCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RestaurantTable {
  id: string;
  table_number: string;
  seats: number;
  status: string;
  zone: string;
  current_customer_name: string | null;
  reserved_time: string | null;
  party_size: number | null;
}

interface TableZone {
  id: string;
  name: string;
  sort_order: number;
}

interface LiveOrder {
  table_number: string;
  status: "pending" | "preparing" | "ready" | "completed";
  order_number: string;
}

interface TableGridViewProps {
  outletId: string;
  selectedTableId?: string;
  onSelectTable?: (tableId: string, tableNumber: string) => void;
  showStatusFilter?: boolean;
  /** When true, only available tables (no live order) are selectable */
  selectableOnlyAvailable?: boolean;
  className?: string;
}

export function TableGridView({
  outletId,
  selectedTableId,
  onSelectTable,
  showStatusFilter = false,
  selectableOnlyAvailable = false,
  className,
}: TableGridViewProps) {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [zones, setZones] = useState<TableZone[]>([]);
  const [liveOrders, setLiveOrders] = useState<LiveOrder[]>([]);
  const [activeZone, setActiveZone] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();

    // Subscribe to real-time table updates
    const tableChannel = supabase
      .channel("table-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "restaurant_tables",
          filter: `outlet_id=eq.${outletId}`,
        },
        () => fetchData()
      )
      .subscribe();

    // Subscribe to real-time order updates
    const orderChannel = supabase
      .channel("order-live-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `outlet_id=eq.${outletId}`,
        },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tableChannel);
      supabase.removeChannel(orderChannel);
    };
  }, [outletId]);

  const fetchData = async () => {
    try {
      const [tablesRes, zonesRes, ordersRes] = await Promise.all([
        supabase
          .from("restaurant_tables")
          .select("*")
          .eq("outlet_id", outletId)
          .order("table_number"),
        supabase
          .from("table_zones")
          .select("*")
          .eq("outlet_id", outletId)
          .order("sort_order"),
        supabase
          .from("orders")
          .select("table_number, status, order_number")
          .eq("outlet_id", outletId)
          .eq("order_type", "dine_in")
          .in("status", ["pending", "preparing", "ready", "completed"]),
      ]);

      if (tablesRes.data) setTables(tablesRes.data);
      if (zonesRes.data) setZones(zonesRes.data);
      if (ordersRes.data) {
        setLiveOrders(
          ordersRes.data.filter((o) => !!o.table_number) as LiveOrder[]
        );
      }
    } catch (error) {
      console.error("Error fetching tables:", error);
    } finally {
      setLoading(false);
    }
  };

  // Build a lookup: tableNumber -> live order
  const liveOrderMap = new Map<string, LiveOrder>();
  for (const o of liveOrders) {
    // Keep the most urgent status if multiple orders exist for the same table
    const existing = liveOrderMap.get(o.table_number);
    if (!existing) {
      liveOrderMap.set(o.table_number, o);
    }
  }

  const filteredTables =
    activeZone === "all"
      ? tables
      : tables.filter(
          (t) => t.zone.toLowerCase() === activeZone.toLowerCase()
        );

  const statusCounts = {
    available: tables.filter(
      (t) => t.status === "available" && !liveOrderMap.has(t.table_number)
    ).length,
    occupied:
      tables.filter((t) => t.status === "occupied").length +
      liveOrderMap.size,
    reserved: tables.filter((t) => t.status === "reserved").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No tables configured yet.</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Add tables in the outlet settings.
        </p>
      </div>
    );
  }

  const tableZones = [...new Set(tables.map((t) => t.zone))];
  const displayZones =
    zones.length > 0 ? zones.map((z) => z.name) : tableZones;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Zone tabs */}
      {displayZones.length > 1 && (
        <Tabs value={activeZone} onValueChange={setActiveZone}>
          <TabsList className="w-full justify-start">
            <TabsTrigger value="all">All</TabsTrigger>
            {displayZones.map((zone) => (
              <TabsTrigger key={zone} value={zone.toLowerCase()}>
                {zone}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* Tables grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filteredTables.map((table) => {
          const liveOrder = liveOrderMap.get(table.table_number);
          const isAvailable =
            table.status === "available" && !liveOrder;
          const canSelect =
            !selectableOnlyAvailable || isAvailable;
          return (
            <TableCard
              key={table.id}
              id={table.id}
              tableNumber={table.table_number}
              seats={table.seats}
              status={
                liveOrder
                  ? "occupied"
                  : (table.status as "available" | "occupied" | "reserved")
              }
              customerName={table.current_customer_name}
              reservedTime={table.reserved_time}
              partySize={table.party_size}
              isSelected={selectedTableId === table.id}
              liveOrderStatus={liveOrder?.status}
              liveOrderNumber={liveOrder?.order_number}
              onClick={
                canSelect
                  ? () => onSelectTable?.(table.id, table.table_number)
                  : undefined
              }
              className={!canSelect ? "opacity-50 cursor-not-allowed" : undefined}
            />
          );
        })}
      </div>

    </div>
  );
}

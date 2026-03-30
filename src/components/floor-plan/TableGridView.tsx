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

interface TableGridViewProps {
  outletId: string;
  selectedTableId?: string;
  onSelectTable?: (tableId: string, tableNumber: string) => void;
  showStatusFilter?: boolean;
  className?: string;
}

export function TableGridView({
  outletId,
  selectedTableId,
  onSelectTable,
  showStatusFilter = false,
  className,
}: TableGridViewProps) {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [zones, setZones] = useState<TableZone[]>([]);
  const [activeZone, setActiveZone] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("table-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "restaurant_tables",
          filter: `outlet_id=eq.${outletId}`,
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [outletId]);

  const fetchData = async () => {
    try {
      const [tablesRes, zonesRes] = await Promise.all([
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
      ]);

      if (tablesRes.data) setTables(tablesRes.data);
      if (zonesRes.data) setZones(zonesRes.data);
    } catch (error) {
      console.error("Error fetching tables:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTables = activeZone === "all" 
    ? tables 
    : tables.filter(t => t.zone.toLowerCase() === activeZone.toLowerCase());

  const statusCounts = {
    available: tables.filter(t => t.status === "available").length,
    occupied: tables.filter(t => t.status === "occupied").length,
    reserved: tables.filter(t => t.status === "reserved").length,
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

  // Get unique zones from tables
  const tableZones = [...new Set(tables.map(t => t.zone))];
  const displayZones = zones.length > 0 
    ? zones.map(z => z.name) 
    : tableZones;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Zone tabs */}
      {displayZones.length > 1 && (
        <Tabs value={activeZone} onValueChange={setActiveZone}>
          <TabsList className="w-full justify-start">
            <TabsTrigger value="all">All</TabsTrigger>
            {displayZones.map(zone => (
              <TabsTrigger key={zone} value={zone.toLowerCase()}>
                {zone}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* Tables grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filteredTables.map((table) => (
          <TableCard
            key={table.id}
            id={table.id}
            tableNumber={table.table_number}
            seats={table.seats}
            status={table.status as "available" | "occupied" | "reserved"}
            customerName={table.current_customer_name}
            reservedTime={table.reserved_time}
            partySize={table.party_size}
            isSelected={selectedTableId === table.id}
            onClick={() => onSelectTable?.(table.id, table.table_number)}
          />
        ))}
      </div>

      {/* Status legend */}
      <div className="flex flex-wrap gap-4 pt-4 border-t">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full border-2 border-dashed border-muted-foreground/30" />
          <span className="text-sm text-muted-foreground">
            Free ({statusCounts.available})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-400" />
          <span className="text-sm text-muted-foreground">
            Reserved ({statusCounts.reserved})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-sm text-muted-foreground">
            Checked-in ({statusCounts.occupied})
          </span>
        </div>
      </div>
    </div>
  );
}

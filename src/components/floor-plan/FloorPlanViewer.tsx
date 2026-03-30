import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TableElement } from "./TableElement";
import { cn } from "@/lib/utils";
import { Loader2, TableIcon } from "lucide-react";

interface RestaurantTable {
  id: string;
  table_number: string;
  shape: "square" | "round" | "rectangle";
  seats: number;
  x_position: number;
  y_position: number;
  width: number;
  height: number;
  rotation: number;
  status: "available" | "occupied" | "reserved";
}

interface FloorPlanViewerProps {
  outletId: string;
  selectedTableId?: string;
  onSelectTable: (tableId: string, tableNumber: string) => void;
  className?: string;
}

export function FloorPlanViewer({
  outletId,
  selectedTableId,
  onSelectTable,
  className,
}: FloorPlanViewerProps) {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!outletId) return;

    const fetchTables = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("*")
        .eq("outlet_id", outletId)
        .order("table_number");

      if (!error && data) {
        setTables(data as RestaurantTable[]);
      }
      setIsLoading(false);
    };

    fetchTables();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("floor-plan-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "restaurant_tables",
          filter: `outlet_id=eq.${outletId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setTables((prev) => [...prev, payload.new as RestaurantTable]);
          } else if (payload.eventType === "UPDATE") {
            setTables((prev) =>
              prev.map((t) =>
                t.id === payload.new.id ? (payload.new as RestaurantTable) : t
              )
            );
          } else if (payload.eventType === "DELETE") {
            setTables((prev) => prev.filter((t) => t.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [outletId]);

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-64", className)}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-64 text-center p-6", className)}>
        <TableIcon className="h-12 w-12 text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground font-medium">No tables configured</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Set up your floor plan in outlet settings
        </p>
      </div>
    );
  }

  return (
    <div className={cn("relative w-full", className)}>
      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-500/30 border border-green-500/50" />
          <span className="text-muted-foreground">Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-orange-500/30 border border-orange-500/50" />
          <span className="text-muted-foreground">Occupied</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-muted border border-muted-foreground/30" />
          <span className="text-muted-foreground">Reserved</span>
        </div>
      </div>

      {/* Floor plan canvas */}
      <div className="relative w-full aspect-[16/10] bg-muted/30 rounded-xl border-2 border-dashed border-border overflow-hidden">
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `
              linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
              linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)
            `,
            backgroundSize: "5% 5%",
          }}
        />

        {/* Tables */}
        {tables.map((table) => (
          <div
            key={table.id}
            className="absolute"
            style={{
              left: `${table.x_position}%`,
              top: `${table.y_position}%`,
              transform: `translate(-50%, -50%) rotate(${table.rotation}deg)`,
            }}
          >
            <TableElement
              id={table.id}
              tableNumber={table.table_number}
              shape={table.shape}
              seats={table.seats}
              status={table.status}
              isSelected={selectedTableId === table.id}
              onClick={() => onSelectTable(table.id, table.table_number)}
              style={{
                width: `${table.width * 4}px`,
                height: table.shape === "rectangle" ? `${table.height * 4}px` : undefined,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

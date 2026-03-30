import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TableElement } from "./TableElement";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Loader2, 
  Plus, 
  Trash2, 
  Save, 
  RotateCw,
  Circle,
  Square,
  RectangleHorizontal,
  GripVertical,
  Layers,
  MousePointer2,
  Move,
  X
} from "lucide-react";
import { toast } from "sonner";

interface RestaurantTable {
  id: string;
  outlet_id: string;
  table_number: string;
  shape: "square" | "round" | "rectangle";
  seats: number;
  x_position: number;
  y_position: number;
  width: number;
  height: number;
  rotation: number;
  status: "available" | "occupied" | "reserved";
  zone: string;
}

interface TableZone {
  id: string;
  name: string;
  color: string;
}

interface FloorPlanEditorProps {
  outletId: string;
  className?: string;
}

const ZONE_COLORS: Record<string, string> = {
  Indoor: "bg-blue-500/10 border-blue-500/30",
  Outdoor: "bg-green-500/10 border-green-500/30",
  Patio: "bg-amber-500/10 border-amber-500/30",
  Bar: "bg-purple-500/10 border-purple-500/30",
  VIP: "bg-pink-500/10 border-pink-500/30",
  Private: "bg-indigo-500/10 border-indigo-500/30",
};

const ZONE_BADGE_COLORS: Record<string, string> = {
  Indoor: "bg-blue-500/20 text-blue-600 border-blue-500/30",
  Outdoor: "bg-green-500/20 text-green-600 border-green-500/30",
  Patio: "bg-amber-500/20 text-amber-600 border-amber-500/30",
  Bar: "bg-purple-500/20 text-purple-600 border-purple-500/30",
  VIP: "bg-pink-500/20 text-pink-600 border-pink-500/30",
  Private: "bg-indigo-500/20 text-indigo-600 border-indigo-500/30",
};

const defaultTable: Omit<RestaurantTable, "id" | "outlet_id"> = {
  table_number: "",
  shape: "square",
  seats: 4,
  x_position: 50,
  y_position: 50,
  width: 12,
  height: 12,
  rotation: 0,
  status: "available",
  zone: "Indoor",
};

export function FloorPlanEditor({ outletId, className }: FloorPlanEditorProps) {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeZoneFilter, setActiveZoneFilter] = useState<string | null>(null);
  const [draggedShape, setDraggedShape] = useState<"square" | "round" | "rectangle" | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const zones = ["Indoor", "Outdoor", "Patio", "Bar", "VIP", "Private"];

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
  }, [outletId]);

  const addTableAtPosition = async (
    shape: "square" | "round" | "rectangle",
    xPercent: number,
    yPercent: number
  ) => {
    const tableCount = tables.length + 1;
    const newTable = {
      ...defaultTable,
      outlet_id: outletId,
      table_number: `T${tableCount}`,
      shape,
      x_position: xPercent,
      y_position: yPercent,
      zone: activeZoneFilter || "Indoor",
    };

    const { data, error } = await supabase
      .from("restaurant_tables")
      .insert(newTable)
      .select()
      .single();

    if (error) {
      toast.error("Failed to add table");
      return;
    }

    setTables((prev) => [...prev, data as RestaurantTable]);
    setSelectedTable(data as RestaurantTable);
    toast.success("Table added! Drag to position.");
  };

  const addTable = async (shape: "square" | "round" | "rectangle") => {
    const tableCount = tables.length + 1;
    const newTable = {
      ...defaultTable,
      outlet_id: outletId,
      table_number: `T${tableCount}`,
      shape,
      x_position: 20 + (tableCount % 4) * 20,
      y_position: 20 + Math.floor(tableCount / 4) * 25,
      zone: activeZoneFilter || "Indoor",
    };

    const { data, error } = await supabase
      .from("restaurant_tables")
      .insert(newTable)
      .select()
      .single();

    if (error) {
      toast.error("Failed to add table");
      return;
    }

    setTables((prev) => [...prev, data as RestaurantTable]);
    setSelectedTable(data as RestaurantTable);
    toast.success("Table added");
  };

  const updateTable = async (updates: Partial<RestaurantTable>) => {
    if (!selectedTable) return;

    const updatedTable = { ...selectedTable, ...updates };
    setSelectedTable(updatedTable);
    setTables((prev) =>
      prev.map((t) => (t.id === selectedTable.id ? updatedTable : t))
    );
  };

  const saveTable = async () => {
    if (!selectedTable) return;

    setIsSaving(true);
    const { error } = await supabase
      .from("restaurant_tables")
      .update({
        table_number: selectedTable.table_number,
        shape: selectedTable.shape,
        seats: selectedTable.seats,
        x_position: selectedTable.x_position,
        y_position: selectedTable.y_position,
        width: selectedTable.width,
        height: selectedTable.height,
        rotation: selectedTable.rotation,
        zone: selectedTable.zone,
      })
      .eq("id", selectedTable.id);

    setIsSaving(false);

    if (error) {
      toast.error("Failed to save changes");
      return;
    }

    toast.success("Table saved");
  };

  const deleteTable = async (tableId?: string) => {
    const idToDelete = tableId || selectedTable?.id;
    if (!idToDelete) return;

    const { error } = await supabase
      .from("restaurant_tables")
      .delete()
      .eq("id", idToDelete);

    if (error) {
      toast.error("Failed to delete table");
      return;
    }

    setTables((prev) => prev.filter((t) => t.id !== idToDelete));
    if (selectedTable?.id === idToDelete) {
      setSelectedTable(null);
    }
    toast.success("Table deleted");
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedShape || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const clampedX = Math.max(10, Math.min(90, x));
    const clampedY = Math.max(10, Math.min(90, y));

    addTableAtPosition(draggedShape, clampedX, clampedY);
    setDraggedShape(null);
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleTableDrag = (e: React.MouseEvent, table: RestaurantTable) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const THRESHOLD = 5;
    let hasDragged = false;
    let lastX = table.x_position;
    let lastY = table.y_position;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!hasDragged) {
        const dx = Math.abs(moveEvent.clientX - startX);
        const dy = Math.abs(moveEvent.clientY - startY);
        if (dx < THRESHOLD && dy < THRESHOLD) return;
        hasDragged = true;
        setIsDragging(true);
      }

      const x = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      const y = ((moveEvent.clientY - rect.top) / rect.height) * 100;
      lastX = Math.max(5, Math.min(95, x));
      lastY = Math.max(5, Math.min(95, y));

      setTables((prev) =>
        prev.map((t) =>
          t.id === table.id ? { ...t, x_position: lastX, y_position: lastY } : t
        )
      );
      setSelectedTable((prev) =>
        prev?.id === table.id ? { ...prev, x_position: lastX, y_position: lastY } : prev
      );
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      if (hasDragged) {
        setIsDragging(false);
        supabase
          .from("restaurant_tables")
          .update({ x_position: lastX, y_position: lastY })
          .eq("id", table.id)
          .then();
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const filteredTables = activeZoneFilter 
    ? tables.filter(t => t.zone === activeZoneFilter)
    : tables;

  const tablesByZone = zones.reduce((acc, zone) => {
    acc[zone] = tables.filter(t => t.zone === zone);
    return acc;
  }, {} as Record<string, RestaurantTable[]>);

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-96", className)}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-card rounded-xl border shadow-sm">
        {/* Draggable Table Shapes */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Drag to add:</span>
          <div className="flex gap-1">
            <div
              draggable
              onDragStart={() => setDraggedShape("square")}
              onDragEnd={() => setDraggedShape(null)}
              className="p-2.5 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary hover:bg-primary/5 cursor-grab active:cursor-grabbing transition-colors"
              title="Drag to add square table"
            >
              <Square className="h-5 w-5 text-muted-foreground" />
            </div>
            <div
              draggable
              onDragStart={() => setDraggedShape("round")}
              onDragEnd={() => setDraggedShape(null)}
              className="p-2.5 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary hover:bg-primary/5 cursor-grab active:cursor-grabbing transition-colors"
              title="Drag to add round table"
            >
              <Circle className="h-5 w-5 text-muted-foreground" />
            </div>
            <div
              draggable
              onDragStart={() => setDraggedShape("rectangle")}
              onDragEnd={() => setDraggedShape(null)}
              className="p-2.5 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary hover:bg-primary/5 cursor-grab active:cursor-grabbing transition-colors"
              title="Drag to add rectangle table"
            >
              <RectangleHorizontal className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </div>

        <div className="h-8 w-px bg-border" />

        {/* Quick Add Buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => addTable("square")}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <Square className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addTable("round")}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <Circle className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addTable("rectangle")}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <RectangleHorizontal className="h-3.5 w-3.5" />
          </Button>
        </div>
        
        <div className="flex-1" />

        {/* Zone Filter */}
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <Select 
            value={activeZoneFilter || "all"} 
            onValueChange={(v) => setActiveZoneFilter(v === "all" ? null : v)}
          >
            <SelectTrigger className="w-[130px] h-8">
              <SelectValue placeholder="All Zones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zones</SelectItem>
              {zones.map(zone => (
                <SelectItem key={zone} value={zone}>
                  {zone} ({tablesByZone[zone]?.length || 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Canvas */}
        <div className="flex-1">
          <div
            ref={canvasRef}
            className={cn(
              "relative w-full aspect-[16/10] bg-muted/20 rounded-xl border-2 overflow-hidden transition-colors",
              isDragging && "cursor-grabbing",
              draggedShape && "border-primary/50 bg-primary/5"
            )}
            onMouseDown={(e) => {
              if (e.target === canvasRef.current) setSelectedTable(null);
            }}
            onDrop={handleCanvasDrop}
            onDragOver={handleCanvasDragOver}
          >
            {/* Grid pattern */}
            <div
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{
                backgroundImage: `
                  linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
                  linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)
                `,
                backgroundSize: "5% 5%",
              }}
            />

            {/* Drop indicator */}
            {draggedShape && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="flex flex-col items-center gap-2 text-primary/60">
                  <Move className="h-8 w-8" />
                  <span className="text-sm font-medium">Drop table here</span>
                </div>
              </div>
            )}

            {/* Tables */}
            {filteredTables.map((table) => (
              <div
                key={table.id}
                className="absolute cursor-grab active:cursor-grabbing group"
                style={{
                  left: `${table.x_position}%`,
                  top: `${table.y_position}%`,
                  transform: `translate(-50%, -50%) rotate(${table.rotation}deg)`,
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setSelectedTable(table);
                  handleTableDrag(e, table);
                }}
              >
                {/* Delete button on hover */}
                <button
                  className="absolute -top-2 -right-2 p-1 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:scale-110"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteTable(table.id);
                  }}
                  title="Delete table"
                >
                  <X className="h-3 w-3" />
                </button>
                
                <TableElement
                  id={table.id}
                  tableNumber={table.table_number}
                  shape={table.shape}
                  seats={table.seats}
                  status={table.status}
                  isSelected={selectedTable?.id === table.id}
                  isEditing
                  style={{
                    width: `${table.width * 4}px`,
                    height: table.shape === "rectangle" ? `${table.height * 4}px` : undefined,
                  }}
                />
                
                {/* Zone indicator badge */}
                <Badge 
                  variant="outline" 
                  className={cn(
                    "absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] px-1.5 py-0 whitespace-nowrap",
                    ZONE_BADGE_COLORS[table.zone] || "bg-muted"
                  )}
                >
                  {table.zone}
                </Badge>
              </div>
            ))}

            {tables.length === 0 && !draggedShape && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-3">
                <MousePointer2 className="h-10 w-10 opacity-50" />
                <div className="text-center">
                  <p className="font-medium">No tables yet</p>
                  <p className="text-sm">Drag a table shape onto the canvas or click + to add</p>
                </div>
              </div>
            )}
          </div>

          {/* Zone Legend */}
          <div className="flex flex-wrap gap-2 mt-3">
            {zones.map(zone => {
              const count = tablesByZone[zone]?.length || 0;
              if (count === 0 && !activeZoneFilter) return null;
              return (
                <Badge 
                  key={zone}
                  variant="outline"
                  className={cn(
                    "cursor-pointer transition-all",
                    ZONE_BADGE_COLORS[zone],
                    activeZoneFilter === zone && "ring-2 ring-primary"
                  )}
                  onClick={() => setActiveZoneFilter(activeZoneFilter === zone ? null : zone)}
                >
                  {zone}: {count}
                </Badge>
              );
            })}
          </div>
        </div>

        {/* Properties Panel */}
        {selectedTable && (
          <div className="w-72 p-4 bg-card border rounded-xl shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Table Properties</h3>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6"
                onClick={() => setSelectedTable(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="table-number">Table Number</Label>
                <Input
                  id="table-number"
                  value={selectedTable.table_number}
                  onChange={(e) => updateTable({ table_number: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="shape">Shape</Label>
                  <Select
                    value={selectedTable.shape}
                    onValueChange={(v) => updateTable({ shape: v as "square" | "round" | "rectangle" })}
                  >
                    <SelectTrigger id="shape">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="square">Square</SelectItem>
                      <SelectItem value="round">Round</SelectItem>
                      <SelectItem value="rectangle">Rectangle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="seats">Seats</Label>
                  <Input
                    id="seats"
                    type="number"
                    min={1}
                    max={12}
                    value={selectedTable.seats}
                    onChange={(e) => updateTable({ seats: parseInt(e.target.value) || 4 })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="zone">Zone</Label>
                <Select
                  value={selectedTable.zone}
                  onValueChange={(v) => updateTable({ zone: v })}
                >
                  <SelectTrigger id="zone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map(zone => (
                      <SelectItem key={zone} value={zone}>{zone}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Size</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={8}
                    max={25}
                    value={selectedTable.width}
                    onChange={(e) => updateTable({ width: parseInt(e.target.value) || 12 })}
                    placeholder="Width"
                  />
                  {selectedTable.shape === "rectangle" && (
                    <Input
                      type="number"
                      min={8}
                      max={25}
                      value={selectedTable.height}
                      onChange={(e) => updateTable({ height: parseInt(e.target.value) || 12 })}
                      placeholder="Height"
                    />
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Rotation</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateTable({ rotation: (selectedTable.rotation + 45) % 360 })}
                  >
                    <RotateCw className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {selectedTable.rotation}°
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t">
              <Button onClick={saveTable} disabled={isSaving} className="flex-1">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Save
              </Button>
              <Button variant="destructive" size="icon" onClick={() => deleteTable()}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Tables Summary */}
      <div className="p-4 bg-muted/30 rounded-xl border">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-sm">Tables Summary</h4>
          <span className="text-sm text-muted-foreground">{tables.length} total</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {zones.map(zone => {
            const count = tablesByZone[zone]?.length || 0;
            if (count === 0) return null;
            return (
              <div 
                key={zone}
                className={cn(
                  "px-3 py-1.5 rounded-lg border text-sm",
                  ZONE_COLORS[zone]
                )}
              >
                <span className="font-medium">{zone}</span>
                <span className="text-muted-foreground ml-1.5">× {count}</span>
              </div>
            );
          })}
          {tables.length === 0 && (
            <p className="text-sm text-muted-foreground">No tables created yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TableCanvasItem, type TableShape, MIN_SIZE, MAX_SIZE } from "./TableCanvasItem";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Plus,
  Trash2,
  Save,
  RotateCw,
  Circle,
  Square,
  RectangleHorizontal,
  Layers,
  MousePointer2,
  Move,
  X,
  Copy,
  Grid3X3,
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

type EditorTool = "select" | TableShape;

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
  const [activeZoneFilter, setActiveZoneFilter] = useState<string | null>(null);
  const [draggedShape, setDraggedShape] = useState<TableShape | null>(null);
  const [editorTool, setEditorTool] = useState<EditorTool>("select");
  const [snapToGrid, setSnapToGrid] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);

  const snap = useCallback((n: number) => (snapToGrid ? Math.round(n / 5) * 5 : n), [snapToGrid]);

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
      width: shape === "rectangle" ? 16 : 12,
      height: shape === "rectangle" ? 10 : 12,
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

  const addTable = async (shape: TableShape) => {
    const n = tables.length + 1;
    await addTableAtPosition(shape, snap(20 + (n % 4) * 20), snap(20 + Math.floor(n / 4) * 25));
  };

  const duplicateTable = async () => {
    if (!selectedTable) return;
    const n = tables.length + 1;
    const copy = {
      ...defaultTable,
      outlet_id: outletId,
      table_number: `${selectedTable.table_number}-copy`,
      shape: selectedTable.shape,
      seats: selectedTable.seats,
      x_position: snap(Math.min(90, selectedTable.x_position + 8)),
      y_position: snap(Math.min(90, selectedTable.y_position + 8)),
      width: selectedTable.width,
      height: selectedTable.height,
      rotation: selectedTable.rotation,
      zone: selectedTable.zone,
    };
    const { data, error } = await supabase.from("restaurant_tables").insert(copy).select().single();
    if (error) {
      toast.error("Failed to duplicate table");
      return;
    }
    setTables((prev) => [...prev, data as RestaurantTable]);
    setSelectedTable(data as RestaurantTable);
    toast.success("Table duplicated");
  };

  const applyTablePatch = (tableId: string, patch: Partial<RestaurantTable>) => {
    setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, ...patch } : t)));
    setSelectedTable((prev) => (prev?.id === tableId ? { ...prev, ...patch } : prev));
  };

  const persistTablePatch = (tableId: string, patch: Partial<RestaurantTable>) => {
    void supabase.from("restaurant_tables").update(patch).eq("id", tableId);
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

    const clampedX = snap(Math.max(10, Math.min(90, x)));
    const clampedY = snap(Math.max(10, Math.min(90, y)));

    addTableAtPosition(draggedShape, clampedX, clampedY);
    setDraggedShape(null);
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (editorTool === "select" || !canvasRef.current) return;
    if ((e.target as HTMLElement).closest("[data-table-item], [data-resize-handle]")) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = snap(Math.max(10, Math.min(90, ((e.clientX - rect.left) / rect.width) * 100)));
    const y = snap(Math.max(10, Math.min(90, ((e.clientY - rect.top) / rect.height) * 100)));
    void addTableAtPosition(editorTool, x, y);
    setEditorTool("select");
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
      <div className="flex flex-wrap items-center gap-2 p-3 bg-card rounded-xl border shadow-sm">
        <Button
          variant={editorTool === "select" ? "default" : "outline"}
          size="sm"
          className="gap-1.5"
          onClick={() => setEditorTool("select")}
          title="Select and move tables"
        >
          <MousePointer2 className="h-4 w-4" />
          Select
        </Button>

        <div className="h-8 w-px bg-border mx-1" />

        {(
          [
            { shape: "square" as const, icon: Square, label: "Square" },
            { shape: "round" as const, icon: Circle, label: "Round" },
            { shape: "rectangle" as const, icon: RectangleHorizontal, label: "Rectangle" },
          ] as const
        ).map(({ shape, icon: Icon, label }) => (
          <button
            key={shape}
            type="button"
            draggable
            onDragStart={() => setDraggedShape(shape)}
            onDragEnd={() => setDraggedShape(null)}
            onClick={() => {
              setEditorTool(shape);
              toast.info(`Click on the canvas to place a ${label.toLowerCase()} table`, { duration: 2500 });
            }}
            className={cn(
              "relative flex flex-col items-center gap-0.5 rounded-lg border-2 px-3 py-2 transition-colors cursor-grab active:cursor-grabbing",
              editorTool === shape
                ? "border-primary bg-primary/10 text-primary"
                : "border-dashed border-muted-foreground/30 hover:border-primary hover:bg-primary/5"
            )}
            title={`${label}: click to place on canvas, or drag onto canvas`}
          >
            <div className="flex items-center gap-1">
              <Icon className="h-5 w-5" />
              <Plus className="h-3 w-3 opacity-60" />
            </div>
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}

        <div className="h-8 w-px bg-border mx-1" />

        <Button
          variant={snapToGrid ? "secondary" : "outline"}
          size="sm"
          className="gap-1.5"
          onClick={() => setSnapToGrid((v) => !v)}
          title="Snap position to grid"
        >
          <Grid3X3 className="h-4 w-4" />
          Snap
        </Button>

        {selectedTable && (
          <>
            <div className="h-8 w-px bg-border mx-1" />
            <Button variant="outline" size="sm" onClick={() => void duplicateTable()} title="Duplicate">
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const rotation = (selectedTable.rotation + 45) % 360;
                updateTable({ rotation });
                persistTablePatch(selectedTable.id, { rotation });
              }}
              title="Rotate 45°"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => void saveTable()} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>
            <Button variant="destructive" size="sm" onClick={() => void deleteTable()}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}

        <div className="flex-1 min-w-[8px]" />

        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select
            value={activeZoneFilter || "all"}
            onValueChange={(v) => setActiveZoneFilter(v === "all" ? null : v)}
          >
            <SelectTrigger className="w-[130px] h-8">
              <SelectValue placeholder="All Zones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zones</SelectItem>
              {zones.map((zone) => (
                <SelectItem key={zone} value={zone}>
                  {zone} ({tablesByZone[zone]?.length || 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {editorTool !== "select" && (
        <p className="text-xs text-primary px-1">
          Place mode: click anywhere on the canvas to add a {editorTool} table, or drag a shape from the toolbar.
        </p>
      )}

      <div className="flex gap-4">
        {/* Canvas */}
        <div className="flex-1">
          <div
            ref={canvasRef}
            data-floor-canvas
            className={cn(
              "relative w-full aspect-[16/10] bg-muted/20 rounded-xl border-2 overflow-hidden transition-colors",
              draggedShape && "border-primary/50 bg-primary/5",
              editorTool !== "select" && "cursor-crosshair"
            )}
            onMouseDown={(e) => {
              if (e.target === canvasRef.current || (e.target as HTMLElement).dataset.floorCanvas !== undefined) {
                if (editorTool === "select") setSelectedTable(null);
              }
            }}
            onClick={handleCanvasClick}
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
              <div key={table.id} data-table-item>
                <TableCanvasItem
                  table={table}
                  isSelected={selectedTable?.id === table.id}
                  zoneBadgeClass={ZONE_BADGE_COLORS[table.zone] || "bg-muted"}
                  onSelect={setSelectedTable}
                  onMove={(id, x, y) => applyTablePatch(id, { x_position: x, y_position: y })}
                  onMoveComplete={(id, x, y) => {
                    const sx = snap(x);
                    const sy = snap(y);
                    applyTablePatch(id, { x_position: sx, y_position: sy });
                    persistTablePatch(id, { x_position: sx, y_position: sy });
                  }}
                  onResize={(id, size) =>
                    applyTablePatch(id, {
                      width: size.width,
                      height: table.shape === "rectangle" ? size.height : size.width,
                    })
                  }
                  onResizeComplete={(id, size) => {
                    const patch = {
                      width: size.width,
                      height: table.shape === "rectangle" ? size.height : size.width,
                    };
                    applyTablePatch(id, patch);
                    persistTablePatch(id, patch);
                  }}
                  onDelete={deleteTable}
                />
              </div>
            ))}

            {tables.length === 0 && !draggedShape && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-3">
                <MousePointer2 className="h-10 w-10 opacity-50" />
                <div className="text-center">
                  <p className="font-medium">No tables yet</p>
                  <p className="text-sm">Pick a shape above — click the canvas or drag it here</p>
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
                <Label>Size (or drag handles on canvas)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={MIN_SIZE}
                    max={MAX_SIZE}
                    value={selectedTable.width}
                    onChange={(e) => {
                      const w = parseInt(e.target.value, 10) || 12;
                      updateTable(
                        selectedTable.shape === "rectangle"
                          ? { width: w }
                          : { width: w, height: w }
                      );
                    }}
                    placeholder="Width"
                  />
                  {selectedTable.shape === "rectangle" && (
                    <Input
                      type="number"
                      min={MIN_SIZE}
                      max={MAX_SIZE}
                      value={selectedTable.height}
                      onChange={(e) =>
                        updateTable({ height: parseInt(e.target.value, 10) || 12 })
                      }
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

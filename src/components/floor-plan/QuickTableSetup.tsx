import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

interface RestaurantTable {
  id: string;
  table_number: string;
  seats: number;
  status: string;
  zone: string;
}

interface QuickTableSetupProps {
  outletId: string;
}

export function QuickTableSetup({ outletId }: QuickTableSetupProps) {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  
  // Generator form
  const [tableCount, setTableCount] = useState("10");
  const [prefix, setPrefix] = useState("T");
  const [defaultSeats, setDefaultSeats] = useState("4");
  const [zone, setZone] = useState("Indoor");

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ table_number: "", seats: "" });

  useEffect(() => {
    fetchTables();
  }, [outletId]);

  const fetchTables = async () => {
    try {
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("id, table_number, seats, status, zone")
        .eq("outlet_id", outletId)
        .order("table_number");

      if (error) throw error;
      setTables(data || []);
    } catch (error) {
      console.error("Error fetching tables:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    const count = parseInt(tableCount);
    if (isNaN(count) || count < 1 || count > 100) {
      toast.error("Please enter a valid number (1-100)");
      return;
    }

    setGenerating(true);
    try {
      // Find the highest existing table number to avoid conflicts
      const existingNumbers = tables.map(t => {
        const match = t.table_number.match(/\d+/);
        return match ? parseInt(match[0]) : 0;
      });
      const startFrom = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

      const newTables = Array.from({ length: count }).map((_, i) => ({
        outlet_id: outletId,
        table_number: `${prefix === "none" ? "" : prefix}${startFrom + i}`,
        seats: parseInt(defaultSeats) || 4,
        zone: zone,
        status: "available",
        shape: "square",
        x_position: 50,
        y_position: 50,
        width: 10,
        height: 10,
        rotation: 0,
      }));

      const { error } = await supabase.from("restaurant_tables").insert(newTables);

      if (error) throw error;

      toast.success(`Created ${count} tables successfully`);
      fetchTables();
    } catch (error: any) {
      console.error("Error generating tables:", error);
      toast.error(error.message || "Failed to generate tables");
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("restaurant_tables")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Table deleted");
      fetchTables();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete table");
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm("Delete all tables? This cannot be undone.")) return;

    try {
      const { error } = await supabase
        .from("restaurant_tables")
        .delete()
        .eq("outlet_id", outletId);

      if (error) throw error;
      toast.success("All tables deleted");
      fetchTables();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete tables");
    }
  };

  const startEdit = (table: RestaurantTable) => {
    setEditingId(table.id);
    setEditValues({ table_number: table.table_number, seats: table.seats.toString() });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({ table_number: "", seats: "" });
  };

  const saveEdit = async () => {
    if (!editingId) return;

    try {
      const { error } = await supabase
        .from("restaurant_tables")
        .update({
          table_number: editValues.table_number,
          seats: parseInt(editValues.seats) || 4,
        })
        .eq("id", editingId);

      if (error) throw error;
      toast.success("Table updated");
      cancelEdit();
      fetchTables();
    } catch (error: any) {
      toast.error(error.message || "Failed to update table");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Generator */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Table Setup</CardTitle>
          <CardDescription>
            Generate multiple tables at once with default settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label htmlFor="count">Number of tables</Label>
              <Input
                id="count"
                type="number"
                value={tableCount}
                onChange={(e) => setTableCount(e.target.value)}
                min={1}
                max={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prefix">Prefix</Label>
              <Select value={prefix} onValueChange={setPrefix}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="T">T (T1, T2...)</SelectItem>
                  <SelectItem value="none">None (1, 2...)</SelectItem>
                  <SelectItem value="A">A (A1, A2...)</SelectItem>
                  <SelectItem value="Table ">Table (Table 1...)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="seats">Seats per table</Label>
              <Input
                id="seats"
                type="number"
                value={defaultSeats}
                onChange={(e) => setDefaultSeats(e.target.value)}
                min={1}
                max={20}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zone">Zone</Label>
              <Select value={zone} onValueChange={setZone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Indoor">Indoor</SelectItem>
                  <SelectItem value="Outdoor">Outdoor</SelectItem>
                  <SelectItem value="Patio">Patio</SelectItem>
                  <SelectItem value="Bar">Bar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="invisible">Generate</Label>
              <Button onClick={handleGenerate} disabled={generating} className="w-full">
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Generate
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tables List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Tables ({tables.length})</CardTitle>
            <CardDescription>Manage individual tables</CardDescription>
          </div>
          {tables.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleDeleteAll}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete All
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {tables.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No tables yet. Use the generator above to create tables.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Table</TableHead>
                  <TableHead>Seats</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tables.map((table) => (
                  <TableRow key={table.id}>
                    <TableCell>
                      {editingId === table.id ? (
                        <Input
                          value={editValues.table_number}
                          onChange={(e) => setEditValues(v => ({ ...v, table_number: e.target.value }))}
                          className="h-8 w-20"
                        />
                      ) : (
                        <span className="font-medium">{table.table_number}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === table.id ? (
                        <Input
                          type="number"
                          value={editValues.seats}
                          onChange={(e) => setEditValues(v => ({ ...v, seats: e.target.value }))}
                          className="h-8 w-16"
                        />
                      ) : (
                        table.seats
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{table.zone}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={table.status === "available" ? "secondary" : "default"}
                        className={
                          table.status === "occupied" ? "bg-green-500" :
                          table.status === "reserved" ? "bg-orange-400" : ""
                        }
                      >
                        {table.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === table.id ? (
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={saveEdit}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={cancelEdit}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => startEdit(table)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(table.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

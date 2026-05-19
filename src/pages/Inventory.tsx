import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useOutlet } from "@/lib/outlet-context";
import { AppLayout } from "@/components/AppLayout";
import { FeatureGate } from "@/components/FeatureGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Package,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  Boxes,
} from "lucide-react";

interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  quantity: number;
  low_stock_threshold: number;
  notes: string | null;
}

const EMPTY_FORM = {
  name: "",
  sku: "",
  unit: "pcs",
  quantity: "0",
  low_stock_threshold: "5",
  notes: "",
};

export default function Inventory() {
  const { user } = useAuth();
  const { currentOutlet } = useOutlet();
  const { toast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user && currentOutlet?.id) void fetchItems();
  }, [user, currentOutlet?.id]);

  const fetchItems = async () => {
    if (!currentOutlet?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("inventory_items" as "orders")
      .select("id, name, sku, unit, quantity, low_stock_threshold, notes")
      .eq("outlet_id", currentOutlet.id)
      .order("name");

    if (error) {
      console.error(error);
      setItems([]);
    } else {
      setItems(
        (data ?? []).map((row) => ({
          ...row,
          quantity: Number(row.quantity),
          low_stock_threshold: Number(row.low_stock_threshold),
        })) as InventoryItem[]
      );
    }
    setLoading(false);
  };

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      sku: item.sku ?? "",
      unit: item.unit,
      quantity: String(item.quantity),
      low_stock_threshold: String(item.low_stock_threshold),
      notes: item.notes ?? "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !currentOutlet?.id || !form.name.trim()) return;

    setSaving(true);
    const payload = {
      owner_id: user.id,
      outlet_id: currentOutlet.id,
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      unit: form.unit.trim() || "pcs",
      quantity: Math.max(0, Number(form.quantity) || 0),
      low_stock_threshold: Math.max(0, Number(form.low_stock_threshold) || 0),
      notes: form.notes.trim() || null,
    };

    const { error } = editingId
      ? await supabase.from("inventory_items" as "orders").update(payload).eq("id", editingId)
      : await supabase.from("inventory_items" as "orders").insert(payload);

    setSaving(false);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
      return;
    }

    toast({ title: editingId ? "Item updated" : "Item added" });
    setDialogOpen(false);
    void fetchItems();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("inventory_items" as "orders").delete().eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
      return;
    }
    toast({ title: "Item removed" });
    void fetchItems();
  };

  const adjustQty = async (item: InventoryItem, delta: number) => {
    const next = Math.max(0, item.quantity + delta);
    const { error } = await supabase
      .from("inventory_items" as "orders")
      .update({ quantity: next })
      .eq("id", item.id);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
      return;
    }
    void fetchItems();
  };

  const lowStockCount = items.filter(
    (i) => i.low_stock_threshold > 0 && i.quantity <= i.low_stock_threshold
  ).length;

  return (
    <AppLayout>
      <FeatureGate feature="inventoryManagement" showUpgradePrompt>
        <div className="p-6 max-w-5xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl gradient-primary glow-primary">
                <Boxes className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold">Inventory</h1>
                <p className="text-sm text-muted-foreground">
                  {currentOutlet?.name ?? "Select an outlet"} — stock tracking
                </p>
              </div>
            </div>
            <Button className="gradient-primary" onClick={openAdd} disabled={!currentOutlet}>
              <Plus className="h-4 w-4 mr-2" />
              Add item
            </Button>
          </div>

          {lowStockCount > 0 && (
            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardContent className="p-4 flex items-center gap-3 text-sm">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <span>
                  <strong>{lowStockCount}</strong> item{lowStockCount > 1 ? "s" : ""} at or below low-stock threshold
                </span>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No inventory items"
              description="Add ingredients, packaging, or supplies to track quantities for this outlet."
              actionLabel="Add first item"
              onAction={openAdd}
            />
          ) : (
            <div className="grid gap-3">
              {items.map((item) => {
                const isLow =
                  item.low_stock_threshold > 0 && item.quantity <= item.low_stock_threshold;
                return (
                  <Card key={item.id} className={isLow ? "border-amber-500/50" : ""}>
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold truncate">{item.name}</p>
                          {isLow && (
                            <Badge variant="outline" className="text-amber-700 border-amber-500/50">
                              Low stock
                            </Badge>
                          )}
                          {item.sku && (
                            <span className="text-xs text-muted-foreground font-mono">{item.sku}</span>
                          )}
                        </div>
                        {item.notes && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{item.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => adjustQty(item, -1)}
                        >
                          −
                        </Button>
                        <span className="min-w-[4rem] text-center font-semibold tabular-nums">
                          {item.quantity} {item.unit}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => adjustQty(item, 1)}
                        >
                          +
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit item" : "Add inventory item"}</DialogTitle>
              <DialogDescription>Track stock for {currentOutlet?.name}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Tomatoes, Takeaway boxes"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>SKU</Label>
                  <Input
                    value={form.sku}
                    onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Input
                    value={form.unit}
                    onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                    placeholder="pcs, kg, L"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={form.quantity}
                    onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Low-stock alert at</Label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={form.low_stock_threshold}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, low_stock_threshold: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Supplier, storage location, etc."
                />
              </div>
              <Button type="submit" className="w-full gradient-primary" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? "Save" : "Add item"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </FeatureGate>
    </AppLayout>
  );
}

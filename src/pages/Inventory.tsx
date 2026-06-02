import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useOutlet } from "@/lib/outlet-context";
import { AppLayout } from "@/components/AppLayout";
import { FeatureGate } from "@/components/FeatureGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  adjustInventoryStock,
  createInventoryItem,
  deleteInventoryItem,
  exportInventoryCsv,
  fetchInventoryItems,
  fetchInventoryMovements,
  updateInventoryItem,
  type InventoryItem,
  type InventoryMovement,
  type InventorySummary,
} from "@/lib/inventory";
import { InventoryStatsCards, InventoryLowStockAlert } from "@/components/inventory/InventoryStatsCards";
import { InventoryCharts } from "@/components/inventory/InventoryCharts";
import {
  EMPTY_INVENTORY_FORM,
  InventoryItemDialog,
  itemToForm,
  type InventoryFormState,
} from "@/components/inventory/InventoryItemDialog";
import { InventoryAdjustDialog } from "@/components/inventory/InventoryAdjustDialog";
import { InventoryMovementFeed } from "@/components/inventory/InventoryMovementFeed";
import {
  Download,
  Loader2,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";

export default function Inventory() {
  const { user } = useAuth();
  const { currentOutlet, loading: outletLoading } = useOutlet();
  const { toast } = useToast();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<InventoryFormState>({ ...EMPTY_INVENTORY_FORM });
  const [saving, setSaving] = useState(false);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [adjustDelta, setAdjustDelta] = useState("1");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const load = useCallback(async () => {
    if (!currentOutlet?.id) return;
    setDataLoading(true);
    try {
      const inv = await fetchInventoryItems(currentOutlet.id);
      setItems(inv.items);
      setSummary(inv.summary);
      try {
        const mov = await fetchInventoryMovements(currentOutlet.id);
        setMovements(mov.movements);
      } catch {
        setMovements([]);
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Could not load inventory",
        description: err instanceof Error ? err.message : "Unknown error",
      });
      setItems([]);
      setSummary(null);
      setMovements([]);
    } finally {
      setDataLoading(false);
    }
  }, [currentOutlet?.id, toast]);

  useEffect(() => {
    if (user && currentOutlet?.id) void load();
  }, [user, currentOutlet?.id, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.sku ?? "").toLowerCase().includes(q) ||
        (item.category ?? "").toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (tab === "low") return item.quantity > 0 && item.quantity <= item.low_stock_threshold;
      if (tab === "out") return item.quantity <= 0;
      return true;
    });
  }, [items, search, tab]);

  const openCreate = () => {
    setEditingItem(null);
    setForm({ ...EMPTY_INVENTORY_FORM });
    setDialogOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setForm(itemToForm(item));
    setDialogOpen(true);
  };

  const openAdjust = (item: InventoryItem) => {
    setAdjustItem(item);
    setAdjustDelta("1");
    setAdjustNotes("");
    setAdjustOpen(true);
  };

  const handleSave = async () => {
    if (!currentOutlet?.id || !form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        category: form.category.trim() || null,
        unit: form.unit.trim() || "pcs",
        quantity: Math.max(0, Number(form.quantity) || 0),
        low_stock_threshold: Math.max(0, Number(form.low_stock_threshold) || 0),
        unit_cost: form.unit_cost.trim() ? Math.max(0, Number(form.unit_cost)) : null,
        notes: form.notes.trim() || null,
      };
      if (editingItem) {
        await updateInventoryItem(editingItem.id, payload);
        toast({ title: "Updated", description: "Inventory item saved" });
      } else {
        await createInventoryItem(currentOutlet.id, payload);
        toast({ title: "Added", description: "Inventory item created" });
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: InventoryItem) => {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    try {
      await deleteInventoryItem(item.id);
      toast({ title: "Deleted", description: "Item removed from inventory" });
      await load();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const handleAdjust = async () => {
    if (!adjustItem) return;
    setAdjusting(true);
    try {
      await adjustInventoryStock(adjustItem.id, {
        delta: Number(adjustDelta),
        notes: adjustNotes.trim() || undefined,
      });
      toast({ title: "Stock updated" });
      setAdjustOpen(false);
      await load();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Adjustment failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setAdjusting(false);
    }
  };

  const handleExport = () => {
    const csv = exportInventoryCsv(items);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-${currentOutlet?.name ?? "outlet"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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

  if (!currentOutlet) {
    return (
      <AppLayout>
        <EmptyState
          icon={Package}
          title="No outlet selected"
          description="Select an outlet to manage inventory"
          actionLabel="Go to outlets"
          onAction={() => {
            window.location.href = "/outlets";
          }}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <FeatureGate feature="inventoryManagement">
        {dataLoading && items.length === 0 ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Stock for {currentOutlet.name}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => void load()}>
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport} disabled={items.length === 0}>
                <Download className="h-4 w-4 mr-1.5" />
                Export CSV
              </Button>
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1.5" />
                Add item
              </Button>
            </div>
          </div>

          <InventoryStatsCards summary={summary} />
          <InventoryLowStockAlert count={summary?.lowStock ?? 0} />
          <InventoryCharts items={items} />

          <Tabs value={tab} onValueChange={setTab}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="low">Low stock</TabsTrigger>
                <TabsTrigger value="out">Out of stock</TabsTrigger>
              </TabsList>
              <div className="relative max-w-sm w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search name, SKU, category…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <TabsContent value={tab} className="mt-4 space-y-4">
              {filtered.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title={items.length === 0 ? "No inventory yet" : "No matching items"}
                  description={
                    items.length === 0
                      ? "Add ingredients and supplies to track stock levels"
                      : "Try a different filter or search term"
                  }
                  actionLabel={items.length === 0 ? "Add first item" : undefined}
                  onAction={items.length === 0 ? openCreate : undefined}
                />
              ) : (
                <div className="grid gap-3">
                  {filtered.map((item) => {
                    const isLow =
                      item.quantity > 0 && item.quantity <= item.low_stock_threshold;
                    const isOut = item.quantity <= 0;
                    return (
                      <Card key={item.id}>
                        <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold">{item.name}</p>
                              {item.category ? (
                                <Badge variant="secondary">{item.category}</Badge>
                              ) : null}
                              {isOut ? (
                                <Badge variant="destructive">Out of stock</Badge>
                              ) : isLow ? (
                                <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">
                                  Low stock
                                </Badge>
                              ) : null}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {item.quantity} {item.unit}
                              {item.sku ? ` · SKU ${item.sku}` : ""}
                              {item.unit_cost != null ? ` · ₹${item.unit_cost}/unit` : ""}
                            </p>
                            {item.notes ? (
                              <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>
                            ) : null}
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Button variant="outline" size="sm" onClick={() => openAdjust(item)}>
                              <SlidersHorizontal className="h-4 w-4 mr-1" />
                              Adjust
                            </Button>
                            <Button variant="outline" size="icon" onClick={() => openEdit(item)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="text-destructive"
                              onClick={() => void handleDelete(item)}
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
            </TabsContent>
          </Tabs>

          <InventoryMovementFeed movements={movements} />

          <InventoryItemDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            form={form}
            onChange={setForm}
            onSubmit={() => void handleSave()}
            saving={saving}
            editing={!!editingItem}
          />

          <InventoryAdjustDialog
            open={adjustOpen}
            onOpenChange={setAdjustOpen}
            item={adjustItem}
            delta={adjustDelta}
            onDeltaChange={setAdjustDelta}
            notes={adjustNotes}
            onNotesChange={setAdjustNotes}
            onSubmit={() => void handleAdjust()}
            saving={adjusting}
          />
        </div>
        )}
      </FeatureGate>
    </AppLayout>
  );
}

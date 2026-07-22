import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckSquare,
  Loader2,
  Pencil,
  Plus,
  Star,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { API_URL } from "@/lib/api-url";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MenuImportDialog } from "@/components/MenuImportDialog";
import {
  CmsMenuItemDialog,
  type CmsMenuItemRecord,
  type CmsMenuVariant,
} from "@/components/cms/CmsMenuItemDialog";
import { BulkEditMenuDialog, type BulkMenuEditPatch } from "@/components/menu/BulkEditMenuDialog";
import { getItemAvailabilityLabel } from "@/lib/menu-availability";

interface OutletRow {
  id: string;
  name: string;
  address: string | null;
  is_active: boolean;
}

interface CategoryRow {
  id: string;
  name: string;
}

interface MenuItemRow extends CmsMenuItemRecord {}

export interface CmsOutletRow {
  id: string;
  name: string;
  address?: string | null;
  is_active: boolean;
}

interface Props {
  userId: string;
  /** From customer overview — avoids extra round-trip when available */
  initialOutlets?: CmsOutletRow[];
}

function resolveImageSrc(url: string | null) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

export function CmsCustomerMenuPanel({ userId, initialOutlets }: Props) {
  const [outlets, setOutlets] = useState<OutletRow[]>(initialOutlets ?? []);
  const [outletId, setOutletId] = useState(initialOutlets?.[0]?.id ?? "");
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [items, setItems] = useState<MenuItemRow[]>([]);
  const [variants, setVariants] = useState<CmsMenuVariant[]>([]);
  const [loadingOutlets, setLoadingOutlets] = useState(true);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [saving, setSaving] = useState(false);

  const [categoryName, setCategoryName] = useState("");
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItemRow | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);

  const variantsByItem = useMemo(() => {
    const map: Record<string, CmsMenuVariant[]> = {};
    for (const v of variants) {
      if (!map[v.menu_item_id as string]) map[v.menu_item_id as string] = [];
      map[v.menu_item_id as string].push(v);
    }
    return map;
  }, [variants]);

  const applyOutlets = useCallback((list: OutletRow[]) => {
    setOutlets(list);
    if (list.length) {
      setOutletId((prev) => (prev && list.some((o) => o.id === prev) ? prev : list[0].id));
    } else {
      setOutletId("");
      setCategories([]);
      setItems([]);
      setVariants([]);
    }
  }, []);

  const loadOutlets = useCallback(async () => {
    setLoadingOutlets(true);
    try {
      const res = await fetch(`${API_URL}/api/cms/customers/${userId}/outlets`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        const hint =
          data.error === "Not found"
            ? "Menu API not available — restart the API server (port 5000)."
            : data.error;
        throw new Error(hint || "Failed to load outlets");
      }
      applyOutlets(data.outlets ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load outlets");
      applyOutlets([]);
    } finally {
      setLoadingOutlets(false);
    }
  }, [userId, applyOutlets]);

  useEffect(() => {
    if (initialOutlets !== undefined) {
      applyOutlets(initialOutlets);
      setLoadingOutlets(false);
      return;
    }
    void loadOutlets();
  }, [userId, initialOutlets, applyOutlets, loadOutlets]);

  const loadMenu = useCallback(async () => {
    if (!outletId) return;
    setLoadingMenu(true);
    try {
      const res = await fetch(`${API_URL}/api/cms/outlets/${outletId}/menu`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load menu");
      setCategories(data.categories ?? []);
      setItems(data.items ?? []);
      setVariants(
        (data.variants ?? []).map(
          (v: {
            id: string;
            menu_item_id: string;
            name: string;
            price_adjustment: number;
            is_default: boolean;
          }) => ({
            id: v.id,
            menu_item_id: v.menu_item_id,
            name: v.name,
            price_adjustment: Number(v.price_adjustment) || 0,
            is_default: !!v.is_default,
          })
        )
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load menu");
    } finally {
      setLoadingMenu(false);
    }
  }, [outletId]);

  useEffect(() => {
    if (outletId) void loadMenu();
  }, [outletId, loadMenu]);

  const filteredItems = useMemo(() => {
    if (filterCategory === "all") return items;
    if (filterCategory === "_none") return items.filter((i) => !i.category_id);
    return items.filter((i) => i.category_id === filterCategory);
  }, [items, filterCategory]);

  const handleAddCategory = async () => {
    if (!categoryName.trim() || !outletId) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/cms/outlets/${outletId}/menu/categories`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: categoryName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create category");
      toast.success("Category created");
      setCategoryName("");
      void loadMenu();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create category");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!outletId || !confirm("Delete this category? Items will be uncategorized.")) return;
    try {
      const res = await fetch(
        `${API_URL}/api/cms/outlets/${outletId}/menu/categories/${categoryId}`,
        { method: "DELETE", credentials: "include" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete category");
      toast.success("Category deleted");
      void loadMenu();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete category");
    }
  };

  const openItemDialog = (item?: MenuItemRow) => {
    setEditingItem(item ?? null);
    setItemDialogOpen(true);
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!outletId || !confirm("Delete this menu item?")) return;
    try {
      const res = await fetch(
        `${API_URL}/api/cms/outlets/${outletId}/menu/items/${itemId}`,
        { method: "DELETE", credentials: "include" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete item");
      if (data.hidden) {
        toast.info(data.message || "Item marked unavailable");
      } else {
        toast.success("Item deleted");
      }
      void loadMenu();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete item");
    }
  };

  const handleBulkEdit = async (patch: BulkMenuEditPatch) => {
    if (!outletId || selectedIds.size === 0) return;
    const res = await fetch(`${API_URL}/api/cms/outlets/${outletId}/menu/items/bulk`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_ids: [...selectedIds], patch }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Bulk update failed");
    toast.success(`Updated ${data.updated ?? selectedIds.size} items`);
    setSelectionMode(false);
    setSelectedIds(new Set());
    void loadMenu();
  };

  const handleBulkDelete = async () => {
    if (!outletId || selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (
      !confirm(
        `Delete ${count} selected menu item${count === 1 ? "" : "s"}? Items used in past orders will be marked unavailable instead.`
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        `${API_URL}/api/cms/outlets/${outletId}/menu/items/bulk-delete`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_ids: [...selectedIds] }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bulk delete failed");

      const details = [
        data.deleted ? `${data.deleted} deleted` : "",
        data.hidden ? `${data.hidden} marked unavailable` : "",
      ].filter(Boolean);
      toast.success(details.join(", ") || "Selected items removed");
      setSelectionMode(false);
      setSelectedIds(new Set());
      await loadMenu();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete selected items");
    } finally {
      setSaving(false);
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const categoryNameById = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? "Uncategorized";

  if (loadingOutlets) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (outlets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5" />
            Menu management
          </CardTitle>
          <CardDescription>This customer has no outlets yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5" />
                Menu management
              </CardTitle>
              <CardDescription>
                Photos, specials, offers, schedules, variants, AI import, and bulk edit.
              </CardDescription>
            </div>
            {outletId && (
              <div className="flex flex-wrap gap-2 shrink-0">
                {items.length > 0 && (
                  <Button
                    size="sm"
                    variant={selectionMode ? "secondary" : "outline"}
                    onClick={() => {
                      if (selectionMode) {
                        setSelectionMode(false);
                        setSelectedIds(new Set());
                      } else {
                        setSelectionMode(true);
                      }
                    }}
                  >
                    <CheckSquare className="h-4 w-4 mr-1" />
                    {selectionMode ? "Cancel" : "Select"}
                  </Button>
                )}
                {selectionMode && selectedIds.size > 0 && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setBulkEditOpen(true)}>
                      Bulk edit ({selectedIds.size})
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={saving}
                      onClick={() => void handleBulkDelete()}
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-1" />
                      )}
                      Delete ({selectedIds.size})
                    </Button>
                  </>
                )}
                <MenuImportDialog
                  outletId={outletId}
                  categories={categories.map((c) => ({ id: c.id, name: c.name }))}
                  onImportComplete={() => void loadMenu()}
                  cmsMode
                />
                <Button size="sm" onClick={() => openItemDialog()}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add item
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1 min-w-[200px] flex-1 max-w-md">
              <Label>Outlet</Label>
              <Select
                value={outletId}
                onValueChange={(v) => {
                  setOutletId(v);
                  setFilterCategory("all");
                  setSelectionMode(false);
                  setSelectedIds(new Set());
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {outlets.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                      {!o.is_active ? " (inactive)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 min-w-[160px]">
              <Label>Filter category</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All items</SelectItem>
                  <SelectItem value="_none">Uncategorized</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loadingMenu ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Categories</Label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <Badge key={c.id} variant="secondary" className="gap-1 pr-1">
                      {c.name}
                      <button
                        type="button"
                        className="ml-1 rounded hover:bg-muted p-0.5"
                        onClick={() => void handleDeleteCategory(c.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2 max-w-md">
                  <Input
                    placeholder="New category"
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                  />
                  <Button variant="outline" disabled={saving || !categoryName.trim()} onClick={() => void handleAddCategory()}>
                    Add
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {selectionMode && items.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                    <p className="text-sm text-muted-foreground">
                      {selectedIds.size} of {items.length} menu items selected
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setSelectedIds((current) => {
                            const next = new Set(current);
                            items.forEach((item) => next.add(item.id));
                            return next;
                          })
                        }
                      >
                        Select all ({items.length})
                      </Button>
                      {selectedIds.size > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedIds(new Set())}
                        >
                          Clear selection
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                {filteredItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6 border rounded-lg">
                    No items in this view. Use AI Import or Add item.
                  </p>
                ) : (
                  filteredItems.map((item) => {
                    const img = resolveImageSrc(item.image_url);
                    const avail = getItemAvailabilityLabel(item);
                    const itemVariants = variantsByItem[item.id] ?? [];
                    return (
                      <div
                        key={item.id}
                        className={`flex gap-3 p-3 border rounded-lg items-center ${
                          selectionMode && selectedIds.has(item.id) ? "ring-2 ring-primary bg-primary/5" : ""
                        }`}
                        onClick={() => {
                          if (selectionMode) toggleSelected(item.id);
                        }}
                        onKeyDown={() => {}}
                        role={selectionMode ? "button" : undefined}
                        tabIndex={selectionMode ? 0 : undefined}
                      >
                        {selectionMode && (
                          <Checkbox
                            checked={selectedIds.has(item.id)}
                            onCheckedChange={() => toggleSelected(item.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        <div className="h-14 w-14 rounded-md bg-muted shrink-0 overflow-hidden">
                          {img ? (
                            <img src={img} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">
                              No img
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {categoryNameById(item.category_id)}
                            {itemVariants.length > 0 && ` · ${itemVariants.length} variant(s)`}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.is_special && (
                              <Badge variant="outline" className="text-[10px] h-5 gap-0.5">
                                <Star className="h-2.5 w-2.5" /> {item.special_label || "Special"}
                              </Badge>
                            )}
                            {item.offer_label && (
                              <Badge variant="outline" className="text-[10px] h-5 text-green-700">
                                {item.offer_label}
                              </Badge>
                            )}
                            <Badge
                              variant="outline"
                              className={`text-[10px] h-5 ${
                                avail.variant === "available"
                                  ? ""
                                  : avail.variant === "scheduled-off"
                                    ? "text-amber-700"
                                    : "text-muted-foreground"
                              }`}
                            >
                              {avail.label}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {item.offer_price != null ? (
                            <>
                              <p className="font-bold text-green-600">₹{item.offer_price}</p>
                              <p className="text-xs line-through text-muted-foreground">₹{item.base_price}</p>
                            </>
                          ) : (
                            <p className="font-bold">₹{item.base_price}</p>
                          )}
                        </div>
                        {!selectionMode && (
                          <div className="flex gap-1 shrink-0">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openItemDialog(item)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive"
                              onClick={() => void handleDeleteItem(item.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {items.length} item{items.length === 1 ? "" : "s"} total · showing {filteredItems.length}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <CmsMenuItemDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        outletId={outletId}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        item={editingItem}
        variants={
          editingItem
            ? (variantsByItem[editingItem.id] ?? []).map((v) => ({
                id: v.id,
                name: v.name,
                price_adjustment: v.price_adjustment,
                is_default: v.is_default,
              }))
            : []
        }
        onSaved={() => void loadMenu()}
      />

      <BulkEditMenuDialog
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        selectedCount={selectedIds.size}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        onApply={handleBulkEdit}
      />
    </div>
  );
}

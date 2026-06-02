import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import type { InventoryItem } from "@/lib/inventory";

export interface InventoryFormState {
  name: string;
  sku: string;
  category: string;
  unit: string;
  quantity: string;
  low_stock_threshold: string;
  unit_cost: string;
  notes: string;
}

export const EMPTY_INVENTORY_FORM: InventoryFormState = {
  name: "",
  sku: "",
  category: "",
  unit: "pcs",
  quantity: "0",
  low_stock_threshold: "5",
  unit_cost: "",
  notes: "",
};

export function itemToForm(item: InventoryItem): InventoryFormState {
  return {
    name: item.name,
    sku: item.sku ?? "",
    category: item.category ?? "",
    unit: item.unit,
    quantity: String(item.quantity),
    low_stock_threshold: String(item.low_stock_threshold),
    unit_cost: item.unit_cost != null ? String(item.unit_cost) : "",
    notes: item.notes ?? "",
  };
}

interface InventoryItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: InventoryFormState;
  onChange: (form: InventoryFormState) => void;
  onSubmit: () => void;
  saving: boolean;
  editing: boolean;
}

export function InventoryItemDialog({
  open,
  onOpenChange,
  form,
  onChange,
  onSubmit,
  saving,
  editing,
}: InventoryItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit item" : "Add inventory item"}</DialogTitle>
          <DialogDescription>Track ingredients, packaging, or supplies for this outlet.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-1">
            <Label>Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              placeholder="e.g. Basmati rice"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>SKU</Label>
              <Input
                value={form.sku}
                onChange={(e) => onChange({ ...form, sku: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Input
                value={form.category}
                onChange={(e) => onChange({ ...form, category: e.target.value })}
                placeholder="Dry goods"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Unit</Label>
              <Input
                value={form.unit}
                onChange={(e) => onChange({ ...form, unit: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Qty</Label>
              <Input
                type="number"
                min={0}
                value={form.quantity}
                onChange={(e) => onChange({ ...form, quantity: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Low at</Label>
              <Input
                type="number"
                min={0}
                value={form.low_stock_threshold}
                onChange={(e) => onChange({ ...form, low_stock_threshold: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Unit cost (₹)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.unit_cost}
              onChange={(e) => onChange({ ...form, unit_cost: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => onChange({ ...form, notes: e.target.value })}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={saving || !form.name.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Save" : "Add item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

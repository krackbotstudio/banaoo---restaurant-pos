import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GST_CATEGORIES } from "@/lib/gst-categories";
import { Loader2, Percent } from "lucide-react";

const UNCHANGED = "__unchanged__";
const GST_NONE = "__none__";

export type BulkMenuEditPatch = {
  category_id?: string | null;
  is_available?: boolean;
  is_veg?: boolean;
  gst_category?: string | null;
};

interface BulkEditMenuDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  categories: { id: string; name: string }[];
  outletGstRates?: Record<string, number> | null;
  onApply: (patch: BulkMenuEditPatch) => Promise<void>;
}

export function BulkEditMenuDialog({
  open,
  onOpenChange,
  selectedCount,
  categories,
  outletGstRates,
  onApply,
}: BulkEditMenuDialogProps) {
  const [categoryChoice, setCategoryChoice] = useState(UNCHANGED);
  const [availabilityChoice, setAvailabilityChoice] = useState(UNCHANGED);
  const [vegChoice, setVegChoice] = useState(UNCHANGED);
  const [gstChoice, setGstChoice] = useState(UNCHANGED);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setCategoryChoice(UNCHANGED);
    setAvailabilityChoice(UNCHANGED);
    setVegChoice(UNCHANGED);
    setGstChoice(UNCHANGED);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const patch: BulkMenuEditPatch = {};
    if (categoryChoice !== UNCHANGED) {
      patch.category_id = categoryChoice === "__uncategorized__" ? null : categoryChoice;
    }
    if (availabilityChoice !== UNCHANGED) {
      patch.is_available = availabilityChoice === "available";
    }
    if (vegChoice !== UNCHANGED) {
      patch.is_veg = vegChoice === "veg";
    }
    if (gstChoice !== UNCHANGED) {
      patch.gst_category = gstChoice === GST_NONE ? null : gstChoice;
    }
    if (Object.keys(patch).length === 0) {
      return;
    }
    setSubmitting(true);
    try {
      await onApply(patch);
      resetForm();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const hasChanges =
    categoryChoice !== UNCHANGED ||
    availabilityChoice !== UNCHANGED ||
    vegChoice !== UNCHANGED ||
    gstChoice !== UNCHANGED;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Bulk edit</DialogTitle>
          <DialogDescription>
            Apply changes to {selectedCount} selected item{selectedCount === 1 ? "" : "s"}. Leave fields on
            &quot;No change&quot; to keep current values.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={categoryChoice} onValueChange={setCategoryChoice}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNCHANGED}>No change</SelectItem>
                <SelectItem value="__uncategorized__">Uncategorized</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Availability</Label>
            <Select value={availabilityChoice} onValueChange={setAvailabilityChoice}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNCHANGED}>No change</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="unavailable">Unavailable (hidden from menu)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Veg / Non-veg</Label>
            <Select value={vegChoice} onValueChange={setVegChoice}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNCHANGED}>No change</SelectItem>
                <SelectItem value="veg">Vegetarian</SelectItem>
                <SelectItem value="nonveg">Non-vegetarian</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Percent className="h-3.5 w-3.5 text-muted-foreground" /> GST category
            </Label>
            <Select value={gstChoice} onValueChange={setGstChoice}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNCHANGED}>No change</SelectItem>
                <SelectItem value={GST_NONE}>No GST</SelectItem>
                {GST_CATEGORIES.map((cat) => {
                  const rate = outletGstRates?.[cat.key] ?? cat.defaultRate;
                  return (
                    <SelectItem key={cat.key} value={cat.key}>
                      {cat.label} — {rate}%
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="gradient-primary" disabled={!hasChanges || submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : `Update ${selectedCount} items`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

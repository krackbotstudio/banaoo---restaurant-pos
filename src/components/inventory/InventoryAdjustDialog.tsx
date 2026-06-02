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
import { Loader2, Minus, Plus } from "lucide-react";
import type { InventoryItem } from "@/lib/inventory";

interface InventoryAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItem | null;
  delta: string;
  onDeltaChange: (value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  onSubmit: () => void;
  saving: boolean;
}

export function InventoryAdjustDialog({
  open,
  onOpenChange,
  item,
  delta,
  onDeltaChange,
  notes,
  onNotesChange,
  onSubmit,
  saving,
}: InventoryAdjustDialogProps) {
  const parsed = Number(delta);
  const preview =
    item && Number.isFinite(parsed) ? Math.max(0, item.quantity + parsed) : item?.quantity;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            {item ? `${item.name} — current: ${item.quantity} ${item.unit}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onDeltaChange(String((Number(delta) || 0) - 1))}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Input
              type="number"
              value={delta}
              onChange={(e) => onDeltaChange(e.target.value)}
              className="text-center"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onDeltaChange(String((Number(delta) || 0) + 1))}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {preview != null && (
            <p className="text-sm text-muted-foreground text-center">
              New quantity: <span className="font-medium text-foreground">{preview}</span>
            </p>
          )}
          <div className="space-y-1">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => onNotesChange(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={saving || !delta || Number(delta) === 0}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { TableGridView } from "./TableGridView";

interface FloorPlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outletId: string;
  selectedTableId?: string;
  onSelectTable: (tableId: string, tableNumber: string) => void;
}

export function FloorPlanModal({
  open,
  onOpenChange,
  outletId,
  selectedTableId,
  onSelectTable,
}: FloorPlanModalProps) {
  const handleSelectTable = (tableId: string, tableNumber: string) => {
    onSelectTable(tableId, tableNumber);
    onOpenChange(false);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Overlay above the Sheet (z-[90]) */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[110] w-[95vw] max-w-3xl max-h-[85vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-background p-6 shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Select a Table</h2>
            <DialogPrimitive.Close className="rounded-sm opacity-70 hover:opacity-100 transition-opacity">
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>
          <TableGridView
            outletId={outletId}
            selectedTableId={selectedTableId}
            onSelectTable={handleSelectTable}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select a Table</DialogTitle>
        </DialogHeader>
        <TableGridView
          outletId={outletId}
          selectedTableId={selectedTableId}
          onSelectTable={handleSelectTable}
        />
      </DialogContent>
    </Dialog>
  );
}
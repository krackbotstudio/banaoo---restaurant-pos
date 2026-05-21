import { TableGridView } from "@/components/floor-plan/TableGridView";

interface CustomerTablePickerProps {
  outletId: string;
  selectedTableId?: string;
  onSelectTable: (tableId: string, tableNumber: string) => void;
}

export function CustomerTablePicker({
  outletId,
  selectedTableId,
  onSelectTable,
}: CustomerTablePickerProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">Tap an available table</p>
      <TableGridView
        outletId={outletId}
        selectedTableId={selectedTableId}
        onSelectTable={onSelectTable}
        selectableOnlyAvailable
      />
    </div>
  );
}

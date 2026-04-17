import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FloorPlanModal } from "@/components/floor-plan";
import { Utensils, Package, MapPin, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface Outlet {
  id: string;
  name: string;
}

interface OrderTopBarProps {
  outlets: Outlet[];
  selectedOutlet: string;
  onOutletChange: (outlet: string) => void;
  orderType: "dine_in" | "takeaway";
  onOrderTypeChange: (type: "dine_in" | "takeaway") => void;
  tableNumber: string;
  onTableChange: (table: string) => void;
  onClearCart: () => void;
  hasItems: boolean;
}

export function OrderTopBar({
  outlets,
  selectedOutlet,
  onOutletChange,
  orderType,
  onOrderTypeChange,
  tableNumber,
  onTableChange,
  onClearCart,
  hasItems,
}: OrderTopBarProps) {
  const [floorPlanOpen, setFloorPlanOpen] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string>();

  const handleSelectTable = (tableId: string, tableNum: string) => {
    setSelectedTableId(tableId);
    onTableChange(tableNum);
  };

  return (
    <div className="w-full bg-background/95 backdrop-blur-sm border-b border-border/50">
      <div className="w-full p-3 md:p-4 space-y-3">

        {/* Row 1: Outlet selector + optional clear cart */}
        <div className="flex w-full items-center gap-2">
          <Select value={selectedOutlet} onValueChange={onOutletChange}>
            <SelectTrigger className="flex-1 min-w-0 h-11 rounded-xl bg-card border-border/50 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="h-4 w-4 text-primary shrink-0" />
                <SelectValue placeholder="Select outlet" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {outlets.map((outlet) => (
                <SelectItem key={outlet.id} value={outlet.id}>
                  {outlet.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasItems && (
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-xl text-destructive hover:bg-destructive/10 hover:border-destructive"
              onClick={onClearCart}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Row 2: Dine In / Takeaway toggle — always full width, never overflows */}
        <div className="w-full grid grid-cols-2 rounded-xl bg-muted/50 p-1 gap-1">
          <button
            type="button"
            onClick={() => onOrderTypeChange("dine_in")}
            className={cn(
              "flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm transition-all",
              orderType === "dine_in"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Utensils className="h-4 w-4 shrink-0" />
            <span>Dine In</span>
          </button>
          <button
            type="button"
            onClick={() => onOrderTypeChange("takeaway")}
            className={cn(
              "flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm transition-all",
              orderType === "takeaway"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Package className="h-4 w-4 shrink-0" />
            <span>Takeaway</span>
          </button>
        </div>

        {/* Row 3: Table selector — only for dine-in, always full width */}
        {orderType === "dine_in" && (
          <>
            <Button
              variant="outline"
              onClick={() => setFloorPlanOpen(true)}
              className={cn(
                "w-full h-11 rounded-xl border-2 transition-all text-sm",
                tableNumber
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-dashed border-muted-foreground/50 text-muted-foreground"
              )}
            >
              {tableNumber ? `Table ${tableNumber} — tap to change` : "Select Table"}
            </Button>
            <FloorPlanModal
              open={floorPlanOpen}
              onOpenChange={setFloorPlanOpen}
              outletId={selectedOutlet}
              selectedTableId={selectedTableId}
              onSelectTable={handleSelectTable}
            />
          </>
        )}
      </div>
    </div>
  );
}

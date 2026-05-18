import { Button } from "@/components/ui/button";
import { FloorPlanModal } from "@/components/floor-plan";
import { Utensils, Package, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface OrderTypeStepProps {
  outletId: string;
  outletName: string;
  orderType: "dine_in" | "takeaway";
  onOrderTypeChange: (type: "dine_in" | "takeaway") => void;
  tableNumber: string;
  onTableChange: (table: string) => void;
  onContinue: () => void;
}

export function OrderTypeStep({
  outletId,
  outletName,
  orderType,
  onOrderTypeChange,
  tableNumber,
  onTableChange,
  onContinue,
}: OrderTypeStepProps) {
  const [floorPlanOpen, setFloorPlanOpen] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string>();

  const advanceToMenu = () => {
    if (!outletId) return;
    requestAnimationFrame(() => onContinue());
  };

  const handleSelectTakeaway = () => {
    onOrderTypeChange("takeaway");
    onTableChange("");
    advanceToMenu();
  };

  const handleSelectDineIn = () => {
    onOrderTypeChange("dine_in");
    if (tableNumber.trim()) {
      advanceToMenu();
    } else {
      setFloorPlanOpen(true);
    }
  };

  const handleSelectTable = (tableId: string, tableNum: string) => {
    setSelectedTableId(tableId);
    onTableChange(tableNum);
    setTimeout(advanceToMenu, 150);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-background">
      <div className="flex-1 p-4 md:p-8 max-w-lg mx-auto w-full space-y-6 pb-8">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Step 1 of 3</p>
          <h1 className="text-2xl font-display font-bold">Order type</h1>
          <p className="text-sm text-muted-foreground">
            Pick takeaway to start, or dine-in and choose a table.
          </p>
        </div>

        <div className="flex items-center gap-2 h-12 px-4 rounded-xl bg-muted/40 border border-border/50">
          <MapPin className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Outlet
            </p>
            <p className="font-medium truncate">{outletName || "—"}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 rounded-xl bg-muted/50 p-1 gap-1">
          <button
            type="button"
            onClick={handleSelectDineIn}
            className={cn(
              "flex flex-col items-center justify-center gap-2 py-6 rounded-lg font-medium transition-all",
              orderType === "dine_in"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Utensils className="h-6 w-6" />
            <span>Dine In</span>
          </button>
          <button
            type="button"
            onClick={handleSelectTakeaway}
            className={cn(
              "flex flex-col items-center justify-center gap-2 py-6 rounded-lg font-medium transition-all",
              orderType === "takeaway"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Package className="h-6 w-6" />
            <span>Takeaway</span>
          </button>
        </div>

        {orderType === "dine_in" && (
          <>
            <Button
              variant="outline"
              onClick={() => setFloorPlanOpen(true)}
              className={cn(
                "w-full h-14 rounded-xl border-2 text-base",
                tableNumber
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-dashed border-muted-foreground/50"
              )}
            >
              {tableNumber ? `Table ${tableNumber} — tap to change` : "Select table"}
            </Button>
            <FloorPlanModal
              open={floorPlanOpen}
              onOpenChange={setFloorPlanOpen}
              outletId={outletId}
              selectedTableId={selectedTableId}
              onSelectTable={handleSelectTable}
            />
          </>
        )}
      </div>
    </div>
  );
}

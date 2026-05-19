import { Button } from "@/components/ui/button";
import { Utensils, Package, ChevronLeft, Store } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderFlowBarProps {
  flowStep: "menu" | "review";
  orderType: "dine_in" | "takeaway";
  tableNumber: string;
  onChangeType: () => void;
  selfService?: boolean;
}

export function OrderFlowBar({
  flowStep,
  orderType,
  tableNumber,
  onChangeType,
  selfService = false,
}: OrderFlowBarProps) {
  const typeLabel = selfService
    ? "Self Service"
    : orderType === "dine_in"
      ? tableNumber
        ? `Dine In · Table ${tableNumber}`
        : "Dine In"
      : "Takeaway";

  const stepLabel = selfService
    ? flowStep === "menu"
      ? "Step 1 · Menu"
      : "Step 2 · Review"
    : flowStep === "menu"
      ? "Step 2 · Menu"
      : "Step 3 · Review";

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-muted/30">
      {!selfService ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs shrink-0"
          onClick={onChangeType}
        >
          <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
          Change
        </Button>
      ) : null}
      <div
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border",
          selfService
            ? "border-orange-400/50 bg-orange-50 text-orange-700"
            : orderType === "dine_in"
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-orange-400/50 bg-orange-50 text-orange-700"
        )}
      >
        {selfService ? (
          <Store className="h-3.5 w-3.5" />
        ) : orderType === "dine_in" ? (
          <Utensils className="h-3.5 w-3.5" />
        ) : (
          <Package className="h-3.5 w-3.5" />
        )}
        {typeLabel}
      </div>
      <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {stepLabel}
      </span>
    </div>
  );
}

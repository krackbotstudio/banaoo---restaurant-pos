import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { getOrderModeBadge } from "@/lib/business-types";

interface OrderFlowBarProps {
  flowStep: "menu" | "review";
  orderType: "dine_in" | "takeaway";
  tableNumber: string;
  onChangeType: () => void;
  selfService?: boolean;
  /** Owner's profile.business_type (drives the chip label/icon). */
  businessType?: string | null;
}

const VARIANT_CLASSES: Record<"primary" | "warning" | "info", string> = {
  primary: "border-primary/40 bg-primary/10 text-primary",
  warning: "border-orange-400/50 bg-orange-50 text-orange-700",
  info: "border-blue-400/50 bg-blue-50 text-blue-700",
};

export function OrderFlowBar({
  flowStep,
  orderType,
  tableNumber,
  onChangeType,
  selfService = false,
  businessType,
}: OrderFlowBarProps) {
  const badge = getOrderModeBadge(businessType, selfService, orderType);
  const Icon = badge.icon;

  // Dine-in includes the table number when one's been picked.
  const typeLabel =
    !selfService && orderType === "dine_in" && tableNumber
      ? `${badge.label} · Table ${tableNumber}`
      : badge.label;

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
          VARIANT_CLASSES[badge.variant]
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        {typeLabel}
      </div>
      <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {stepLabel}
      </span>
    </div>
  );
}

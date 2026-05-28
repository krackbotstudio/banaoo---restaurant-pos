import { ArrowLeft, ShoppingBag, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PosOrderWorkspace } from "@/components/order/PosOrderWorkspace";
import { cn } from "@/lib/utils";

export type InlinePosSession =
  | {
      mode: "new";
      orderType: "dine_in" | "takeaway";
      tableNumber?: string;
      label: string;
    }
  | {
      mode: "add";
      orderId: string;
      orderType: string;
      tableNumber: string;
      label: string;
    };

interface VisualPosOverlayProps {
  session: InlinePosSession;
  onClose: () => void;
  onComplete: () => void;
}

export function VisualPosOverlay({ session, onClose, onComplete }: VisualPosOverlayProps) {
  const isAdd = session.mode === "add";
  const orderType =
    session.mode === "new"
      ? session.orderType
      : (session.orderType === "takeaway" ? "takeaway" : "dine_in");

  return (
    <div className="fixed inset-0 z-[65] bg-background flex flex-col">
      <header className="h-14 shrink-0 border-b flex items-center gap-3 px-4 bg-background/95 backdrop-blur-sm">
        <Button variant="ghost" size="sm" className="gap-2 shrink-0" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />
          Back to floor
        </Button>
        <div className="flex items-center gap-2 min-w-0">
          {orderType === "dine_in" ? (
            <Utensils className="h-4 w-4 text-primary shrink-0" />
          ) : (
            <ShoppingBag className="h-4 w-4 text-orange-500 shrink-0" />
          )}
          <span className="font-semibold truncate">{session.label}</span>
        </div>
      </header>

      <div className={cn("flex-1 min-h-0 overflow-hidden")}>
        <PosOrderWorkspace
          embedded
          forceMenuStep
          addToOrderId={isAdd ? session.orderId : null}
          addToTable={isAdd ? session.tableNumber : ""}
          addToType={orderType}
          initialOrderType={session.mode === "new" ? session.orderType : orderType}
          initialTableNumber={
            session.mode === "new" ? session.tableNumber ?? "" : session.tableNumber
          }
          onComplete={onComplete}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}

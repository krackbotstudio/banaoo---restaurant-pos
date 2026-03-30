import { Button } from "@/components/ui/button";
import { ShoppingCart, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface CartSummaryBarProps {
  itemCount: number;
  total: number;
  onViewCart: () => void;
  className?: string;
}

export function CartSummaryBar({
  itemCount,
  total,
  onViewCart,
  className,
}: CartSummaryBarProps) {
  if (itemCount === 0) return null;

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 p-4 animate-slide-up",
        "bg-gradient-to-t from-background via-background to-background/95",
        "border-t border-border/50 backdrop-blur-sm",
        "md:left-[var(--sidebar-width)]",
        className
      )}
    >
      <Button
        onClick={onViewCart}
        className="w-full h-14 rounded-2xl gradient-primary glow-primary text-lg font-semibold shadow-2xl"
      >
        <div className="flex items-center justify-between w-full px-2">
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShoppingCart className="h-5 w-5" />
              <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-primary-foreground text-primary text-xs font-bold flex items-center justify-center">
                {itemCount}
              </span>
            </div>
            <span>{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold">₹{total}</span>
            <ChevronUp className="h-5 w-5" />
          </div>
        </div>
      </Button>
    </div>
  );
}

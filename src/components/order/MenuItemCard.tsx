import { cn } from "@/lib/utils";
import { Plus, Minus } from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  is_veg: boolean;
  is_available: boolean;
  category_id: string | null;
}

interface MenuItemCardProps {
  item: MenuItem;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
}

export function MenuItemCard({ item, quantity, onAdd, onRemove }: MenuItemCardProps) {
  const inCart = quantity > 0;

  return (
    <div
      className={cn(
        "relative w-full p-4 rounded-2xl border-2 transition-all duration-200",
        inCart
          ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
          : "border-border/50 bg-card hover:border-primary/40 hover:shadow-md"
      )}
    >
      <div className="flex items-start gap-3 mb-3">
        {/* Veg/Non-veg indicator */}
        <div
          className={cn(
            "mt-1 w-4 h-4 rounded-sm border-2 flex items-center justify-center shrink-0",
            item.is_veg ? "border-green-500" : "border-red-500"
          )}
        >
          <div
            className={cn(
              "w-2 h-2 rounded-full",
              item.is_veg ? "bg-green-500" : "bg-red-500"
            )}
          />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate text-sm">{item.name}</p>
          {item.description && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
              {item.description}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="font-bold text-primary text-sm">₹{item.base_price}</span>
            {inCart && (
              <span className="text-xs text-muted-foreground">
                = ₹{item.base_price * quantity}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action row */}
      {inCart ? (
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={onRemove}
            className="h-7 w-7 rounded-full bg-muted flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-6 text-center font-bold text-sm">{quantity}</span>
          <button
            type="button"
            onClick={onAdd}
            className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onAdd}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-muted/60 hover:bg-primary hover:text-primary-foreground text-muted-foreground transition-all text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      )}
    </div>
  );
}

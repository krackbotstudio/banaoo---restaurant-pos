import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { FloorPlanModal } from "@/components/floor-plan";
import { Minus, Plus, Trash2, ShoppingCart, X, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  is_veg: boolean;
  is_available: boolean;
  category_id: string | null;
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

interface CartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: CartItem[];
  orderType: "dine_in" | "takeaway";
  tableNumber: string;
  outletId: string;
  onTableChange: (table: string) => void;
  onUpdateQuantity: (itemId: string, delta: number) => void;
  onRemoveItem: (itemId: string) => void;
  onPlaceOrder: () => void;
  cartTotal: number;
}

export function CartDrawer({
  open,
  onOpenChange,
  cart,
  orderType,
  tableNumber,
  outletId,
  onTableChange,
  onUpdateQuantity,
  onRemoveItem,
  onPlaceOrder,
  cartTotal,
}: CartDrawerProps) {
  const [floorPlanOpen, setFloorPlanOpen] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string>();

  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleSelectTable = (tableId: string, tableNum: string) => {
    setSelectedTableId(tableId);
    onTableChange(tableNum);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b border-border/50">
          <div className="flex items-center justify-between">
            <DrawerTitle className="font-display text-xl">
              Your Order
            </DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <X className="h-5 w-5" />
              </Button>
            </DrawerClose>
          </div>
          <p className="text-sm text-muted-foreground">
            {cartItemsCount} items · ₹{cartTotal}
          </p>
        </DrawerHeader>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Table selector for dine-in */}
          {orderType === "dine_in" && (
            <>
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">
                    {tableNumber ? `Table ${tableNumber}` : "No table selected"}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-primary hover:text-primary"
                  onClick={() => setFloorPlanOpen(true)}
                >
                  {tableNumber ? "Change" : "Select Table"}
                </Button>
              </div>
              <FloorPlanModal
                open={floorPlanOpen}
                onOpenChange={setFloorPlanOpen}
                outletId={outletId}
                selectedTableId={selectedTableId}
                onSelectTable={handleSelectTable}
              />
            </>
          )}

          {/* Cart items */}
          <div className="space-y-2">
            {cart.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted/30 flex items-center justify-center">
                  <ShoppingCart className="h-10 w-10 opacity-30" />
                </div>
                <p className="font-medium">Cart is empty</p>
                <p className="text-xs mt-1 opacity-70">
                  Tap items from the menu to add
                </p>
              </div>
            ) : (
              cart.map((item, index) => (
                <div
                  key={item.menuItem.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50 animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Veg indicator */}
                  <div
                    className={cn(
                      "w-3 h-3 rounded-full shrink-0",
                      item.menuItem.is_veg ? "bg-green-500" : "bg-red-500"
                    )}
                  />

                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">{item.menuItem.name}</p>
                    <p className="text-xs text-primary font-semibold">
                      ₹{item.menuItem.base_price} × {item.quantity} = ₹
                      {item.menuItem.base_price * item.quantity}
                    </p>
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => onUpdateQuantity(item.menuItem.id, -1)}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="w-7 text-center font-bold text-sm">
                      {item.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => onUpdateQuantity(item.menuItem.id, 1)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
                      onClick={() => onRemoveItem(item.menuItem.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <DrawerFooter className="border-t border-border/50 bg-card">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold text-primary">₹{cartTotal}</p>
            </div>
            {orderType === "dine_in" && tableNumber && (
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Table</p>
                <p className="font-semibold">{tableNumber}</p>
              </div>
            )}
          </div>
          <Button
            className="w-full h-14 text-lg font-semibold gradient-primary glow-primary rounded-xl"
            disabled={cart.length === 0}
            onClick={onPlaceOrder}
          >
            <ShoppingCart className="h-5 w-5 mr-2" />
            Place Order · ₹{cartTotal}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

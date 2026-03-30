import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export interface CartItem {
  menu_item_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  image_url?: string | null;
  notes?: string;
}

interface CartContextValue {
  items: CartItem[];
  outletId: string | null;
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (menu_item_id: string) => void;
  updateQty: (menu_item_id: string, qty: number) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextValue | null>(null);

function storageKey(outletId: string) {
  return `cart_${outletId}`;
}

export function CartProvider({ outletId, children }: { outletId: string; children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey(outletId));
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(storageKey(outletId), JSON.stringify(items));
  }, [items, outletId]);

  const addItem = useCallback((item: Omit<CartItem, "quantity">) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.menu_item_id === item.menu_item_id);
      if (existing) {
        return prev.map((i) =>
          i.menu_item_id === item.menu_item_id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  }, []);

  const removeItem = useCallback((menu_item_id: string) => {
    setItems((prev) => prev.filter((i) => i.menu_item_id !== menu_item_id));
  }, []);

  const updateQty = useCallback((menu_item_id: string, qty: number) => {
    if (qty <= 0) {
      setItems((prev) => prev.filter((i) => i.menu_item_id !== menu_item_id));
    } else {
      setItems((prev) =>
        prev.map((i) => (i.menu_item_id === menu_item_id ? { ...i, quantity: qty } : i))
      );
    }
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    localStorage.removeItem(storageKey(outletId));
  }, [outletId]);

  const total = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, outletId, addItem, removeItem, updateQty, clearCart, total, itemCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

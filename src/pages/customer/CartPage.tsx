import { useNavigate } from "react-router-dom";
import { useCart } from "@/context/cart-context";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useAuth } from "@/lib/auth";

interface Outlet {
  id: string;
  name: string;
}

export default function CartPage({ outlet }: { outlet: Outlet }) {
  const navigate = useNavigate();
  const { items, updateQty, removeItem, total, itemCount } = useCart();
  const { getImageUrl } = useAuth();

  if (itemCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-gray-400 px-8 text-center">
        <ShoppingBag className="h-14 w-14" />
        <div>
          <p className="font-semibold text-gray-600">Your cart is empty</p>
          <p className="text-sm mt-1">Add items from the menu to get started</p>
        </div>
        <button
          onClick={() => navigate(`/r/${outlet.id}`)}
          className="mt-2 bg-primary text-primary-foreground text-sm font-semibold px-6 py-2.5 rounded-xl"
        >
          Browse Menu
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 px-4 py-4 space-y-3">
        <h2 className="font-bold text-base text-gray-900">Your Order</h2>
        {items.map((item) => (
          <div key={item.menu_item_id} className="bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm border border-gray-100">
            {item.image_url && (
              <img src={getImageUrl(item.image_url)} alt={item.name} className="w-14 h-14 object-cover rounded-lg flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900 truncate">{item.name}</p>
              <p className="text-sm text-gray-500 mt-0.5">₹{item.unit_price.toFixed(0)} each</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => updateQty(item.menu_item_id, item.quantity - 1)}
                className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                {item.quantity === 1 ? <Trash2 className="h-3.5 w-3.5 text-red-500" /> : <Minus className="h-3.5 w-3.5 text-gray-600" />}
              </button>
              <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
              <button
                onClick={() => updateQty(item.menu_item_id, item.quantity + 1)}
                className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                <Plus className="h-3.5 w-3.5 text-gray-600" />
              </button>
            </div>
            <span className="font-bold text-sm text-gray-900 w-16 text-right">
              ₹{(item.unit_price * item.quantity).toFixed(0)}
            </span>
          </div>
        ))}

        {/* Bill Summary */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-2">
          <h3 className="font-semibold text-sm text-gray-900 mb-3">Bill Summary</h3>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal ({itemCount} items)</span>
            <span>₹{total.toFixed(0)}</span>
          </div>
          <div className="border-t border-gray-100 pt-2 flex justify-between font-bold text-sm text-gray-900">
            <span>Total</span>
            <span>₹{total.toFixed(0)}</span>
          </div>
        </div>
      </div>

      {/* Checkout Button */}
      <div className="sticky bottom-16 px-4 pb-3 bg-gray-50 pt-2">
        <button
          onClick={() => navigate(`/r/${outlet.id}/checkout`)}
          className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl text-sm flex items-center justify-between px-5"
        >
          <span>{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
          <span>Proceed to Checkout →</span>
          <span>₹{total.toFixed(0)}</span>
        </button>
      </div>
    </div>
  );
}

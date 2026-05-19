import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useOutlet } from "@/lib/outlet-context";
import { resolveGstRate } from "@/lib/gst-categories";
import { AppLayout } from "@/components/AppLayout";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { isItemEffectivelyAvailable } from "@/lib/menu-availability";
import {
  Loader2, Search, ShoppingCart, UtensilsCrossed,
  Mic, MicOff, Sparkles, CheckCircle2, AlertCircle, X, Utensils, Package, Store,
  Minus, Plus, Trash2, PlusCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";

import { OrderTypeStep } from "@/components/order/OrderTypeStep";
import { OrderFlowBar } from "@/components/order/OrderFlowBar";
import { CategoryTabs } from "@/components/order/CategoryTabs";
import { MenuItemCard } from "@/components/order/MenuItemCard";
import { CartSummaryBar } from "@/components/order/CartSummaryBar";
import { CartDrawer } from "@/components/order/CartDrawer";
import { OrderSuccessDialog } from "@/components/order/OrderSuccessDialog";
import { usePrinterSettings } from "@/lib/use-printer-settings";
import { printKitchenOrderSlip } from "@/lib/print-kitchen";
import { isSelfServiceMode } from "@/lib/outlet-operation";
import { toast as sonnerToast } from "sonner";

interface Category {
  id: string;
  name: string;
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  is_veg: boolean;
  is_available: boolean;
  category_id: string | null;
  gst_category: string | null;
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

interface OrderData {
  outletId?: string;
  orderNumber: string;
  outletName: string;
  orderType: "dine_in" | "takeaway";
  tableNumber?: string;
  items: { name: string; quantity: number; unitPrice: number; totalPrice: number; gstRate?: number }[];
  subtotal: number;
  total: number;
  createdAt: Date;
}

// ── Voice POS Order Component ─────────────────────────────────────────────────
interface SRInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: any) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
declare global {
  interface Window {
    SpeechRecognition: new () => SRInstance;
    webkitSpeechRecognition: new () => SRInstance;
  }
}

type VoicePOSState = "idle" | "listening" | "processing" | "result" | "error";

interface VoiceResult {
  items: { menu_item_id: string; name: string; quantity: number }[];
  order_type: "dine_in" | "takeaway";
  table_number: string | null;
}

function VoicePOSOrder({
  open,
  onOpenChange,
  menuItems,
  onResult,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  menuItems: MenuItem[];
  onResult: (result: VoiceResult) => void;
}) {
  const [state, setState] = useState<VoicePOSState>("idle");
  const [liveText, setLiveText] = useState("");
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<VoiceResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const recognitionRef = useRef<SRInstance | null>(null);
  const supported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const reset = useCallback(() => {
    setState("idle");
    setLiveText("");
    setTranscript("");
    setResult(null);
    setErrorMsg("");
  }, []);

  useEffect(() => {
    if (!open) {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      reset();
    }
  }, [open, reset]);

  const processTranscript = useCallback(
    async (text: string) => {
      setState("processing");
      setLiveText("");
      setTranscript(text);

      const menuForAI = menuItems.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.base_price,
      }));

      try {
        const API_URL = import.meta.env.VITE_API_URL ?? "";
        const response = await fetch(`${API_URL}/api/voice-order`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: text, menu_items: menuForAI, mode: "pos" })
        });
        const data = await response.json();

        if (!response.ok || !data?.items) {
          setErrorMsg("Couldn't understand the order. Please try again.");
          setState("error");
          return;
        }
        if (data.items.length === 0) {
          setErrorMsg("No matching menu items found. Try speaking more clearly.");
          setState("error");
          return;
        }
        setResult(data as VoiceResult);
        setState("result");
      } catch {
        setErrorMsg("Something went wrong. Please try again.");
        setState("error");
      }
    },
    [menuItems]
  );

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-IN";
    recognitionRef.current = recognition;

    let accumulated = "";

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) accumulated += res[0].transcript;
        else interim += res[0].transcript;
      }
      setLiveText(accumulated + interim);
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      const text = accumulated.trim();
      if (text) processTranscript(text);
      else setState("idle");
    };

    recognition.onerror = (event: any) => {
      if (event.error === "aborted") return;
      setErrorMsg(
        event.error === "not-allowed"
          ? "Microphone access denied. Please allow mic and retry."
          : event.error === "no-speech"
          ? "No speech detected. Please speak clearly and try again."
          : "Voice capture failed. Please try again."
      );
      setState("error");
      recognitionRef.current = null;
    };

    recognition.start();
    setState("listening");
    setLiveText("");
    setTranscript("");
    setResult(null);
    setErrorMsg("");
  }, [processTranscript]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  }, []);

  const handleConfirm = () => {
    if (result) {
      onResult(result);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-orange-400 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-white" />
            <span className="text-white font-bold">AI Voice Order</span>
            <span className="text-[10px] text-white/70 bg-white/20 px-2 py-0.5 rounded-full">
              Any language
            </span>
          </div>
          <button onClick={() => onOpenChange(false)} className="text-white/80 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-6 space-y-5">
          {/* IDLE */}
          {state === "idle" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <p className="text-sm text-muted-foreground text-center">
                Customer speaks their order — AI identifies items, order type and table number automatically.
              </p>
              <div className="text-xs text-muted-foreground bg-muted/50 rounded-xl px-4 py-3 w-full space-y-1">
                <p className="font-medium text-foreground mb-1">Example phrases:</p>
                <p>"Two butter chicken, one naan, dine in, table 5"</p>
                <p>"Ek paneer tikka aur do lassi, takeaway"</p>
                <p>"Rendo biryani, table number 3 lo"</p>
              </div>
              {supported ? (
                <button
                  onClick={startListening}
                  className="flex items-center gap-3 bg-primary text-white font-bold px-8 py-4 rounded-2xl shadow-lg hover:bg-primary/90 active:scale-95 transition-all"
                >
                  <Mic className="h-6 w-6" />
                  Start Listening
                </button>
              ) : (
                <p className="text-sm text-destructive text-center">
                  Voice ordering requires Chrome or Edge browser.
                </p>
              )}
            </div>
          )}

          {/* LISTENING */}
          {state === "listening" && (
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-25 scale-150" />
                <div className="relative h-16 w-16 rounded-full bg-red-500 flex items-center justify-center shadow-xl">
                  <Mic className="h-8 w-8 text-white" />
                </div>
              </div>
              <p className="text-base font-semibold text-gray-700">Listening…</p>
              {liveText ? (
                <div className="bg-muted/50 rounded-xl px-4 py-3 w-full min-h-[60px]">
                  <p className="text-sm text-gray-700 italic">"{liveText}"</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center">
                  Ask the customer to speak their order now
                </p>
              )}
              <button
                onClick={() => { stopListening(); setState("idle"); }}
                className="flex items-center gap-2 border-2 border-gray-200 text-gray-600 font-semibold px-6 py-2.5 rounded-xl text-sm"
              >
                <MicOff className="h-4 w-4" />
                Stop
              </button>
            </div>
          )}

          {/* PROCESSING */}
          {state === "processing" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
              <p className="font-semibold text-gray-700">Understanding order…</p>
              {transcript && (
                <div className="bg-muted/50 rounded-xl px-4 py-3 w-full">
                  <p className="text-xs text-muted-foreground mb-1">Heard:</p>
                  <p className="text-sm text-gray-700 italic">"{transcript}"</p>
                </div>
              )}
            </div>
          )}

          {/* RESULT */}
          {state === "result" && result && (
            <>
              {transcript && (
                <div className="bg-muted/50 rounded-xl px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-1">Customer said:</p>
                  <p className="text-sm text-gray-700 italic">"{transcript}"</p>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 font-semibold text-sm ${
                  result.order_type === "dine_in"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-orange-400 bg-orange-50 text-orange-600"
                }`}>
                  {result.order_type === "dine_in"
                    ? <><Utensils className="h-4 w-4" /> Dine In</>
                    : <><Package className="h-4 w-4" /> Takeaway</>
                  }
                </div>
                {result.order_type === "dine_in" && result.table_number && (
                  <div className="px-4 py-2 rounded-xl border-2 border-primary bg-primary/10 text-primary font-semibold text-sm">
                    Table {result.table_number}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Items detected
                </p>
                <div className="space-y-2">
                  {result.items.map((item) => (
                    <div
                      key={item.menu_item_id}
                      className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="text-sm font-semibold text-gray-900">{item.name}</span>
                      </div>
                      <span className="text-sm font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                        ×{item.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { reset(); setTimeout(startListening, 100); }}
                  className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-600"
                >
                  Retry
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-bold"
                >
                  Add to Cart →
                </button>
              </div>
            </>
          )}

          {/* ERROR */}
          {state === "error" && (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="h-14 w-14 rounded-full bg-red-50 border border-red-200 flex items-center justify-center">
                <AlertCircle className="h-7 w-7 text-red-500" />
              </div>
              <p className="text-sm text-center text-gray-700">{errorMsg}</p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => onOpenChange(false)}
                  className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-600"
                >
                  Cancel
                </button>
                {supported && (
                  <button
                    onClick={() => { reset(); setTimeout(startListening, 100); }}
                    className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-bold"
                  >
                    Try Again
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main NewOrder Page ─────────────────────────────────────────────────────────
export default function NewOrder() {
  const { user } = useAuth();
  const { currentOutlet, outlets, loading: outletLoading } = useOutlet();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // "Add items to existing order" mode — populated from query params
  const addToOrderId = searchParams.get("addTo") || null;
  const addToTable   = searchParams.get("table") || "";
  const addToType    = (searchParams.get("type") || "dine_in") as "dine_in" | "takeaway";

  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const selfService = isSelfServiceMode(currentOutlet?.operation_mode);
  const [orderType, setOrderType] = useState<"dine_in" | "takeaway">(
    addToOrderId ? addToType : selfService ? "takeaway" : "dine_in"
  );
  const [tableNumber, setTableNumber] = useState(addToOrderId ? addToTable : "");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [lastOrderData, setLastOrderData] = useState<OrderData | null>(null);
  const { settings: printerSettings } = usePrinterSettings(currentOutlet?.id);
  const [searchQuery, setSearchQuery] = useState("");
  const [voiceOpen, setVoiceOpen] = useState(false);
  type FlowStep = "type" | "menu" | "review";
  const [flowStep, setFlowStep] = useState<FlowStep>(
    addToOrderId ? "menu" : selfService ? "menu" : "type"
  );

  const fireOrderPrint = useCallback(
    async (input: {
      orderNumber: string;
      orderType: "dine_in" | "takeaway";
      tableNumber?: string;
      items: { name: string; quantity: number; totalPrice: number; gstRate?: number }[];
      createdAt: Date;
      total: number;
      source?: string;
    }) => {
      if (selfService) {
        // Printing handled in OrderSuccessDialog (bill cut, then kitchen slip).
        return;
      }
      const result = await printKitchenOrderSlip(printerSettings, {
        outletId: currentOutlet?.id,
        orderNumber: input.orderNumber,
        orderType: input.orderType,
        tableNumber: input.tableNumber,
        items: input.items,
        createdAt: input.createdAt,
        source: input.source,
      });
      if (!result.ok) {
        sonnerToast.error("Kitchen print failed", { description: result.message });
      }
    },
    [printerSettings, currentOutlet?.id, currentOutlet?.name, selfService]
  );

  const goToReview = () => {
    if (cart.length === 0) {
      toast({ variant: "destructive", title: "Cart is empty" });
      return;
    }
    setFlowStep("review");
    setCartDrawerOpen(true);
  };

  const handleChangeOrderType = () => {
    if (selfService) return;
    if (cart.length > 0 && !window.confirm("Change order type? This will clear the cart.")) return;
    clearCart();
    setFlowStep("type");
  };

  useEffect(() => {
    if (currentOutlet) {
      fetchCategories();
      fetchMenuItems();
    }
  }, [currentOutlet]);

  useEffect(() => {
    if (!addToOrderId && isSelfServiceMode(currentOutlet?.operation_mode)) {
      setOrderType("takeaway");
      setFlowStep("menu");
    }
  }, [currentOutlet?.operation_mode, addToOrderId]);

  const fetchCategories = async () => {
    if (!currentOutlet) return;
    setLoading(true);
    const { data } = await supabase
      .from("menu_categories")
      .select("*")
      .eq("outlet_id", currentOutlet.id)
      .order("sort_order");
    setCategories(data || []);
    setLoading(false);
  };

  const fetchMenuItems = async () => {
    if (!currentOutlet) return;
    const { data } = await supabase
      .from("menu_items")
      .select("*")
      .eq("outlet_id", currentOutlet.id)
      .order("name");
    setMenuItems((data || []).filter(isItemEffectivelyAvailable));
  };

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItem.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.menuItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { menuItem: item, quantity: 1 }];
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.menuItem.id === itemId ? { ...c, quantity: c.quantity + delta } : c
        )
        .filter((c) => c.quantity > 0)
    );
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((c) => c.menuItem.id !== itemId));
  };

  const clearCart = () => setCart([]);

  const cartTotal = cart.reduce(
    (sum, item) => sum + item.menuItem.base_price * item.quantity,
    0
  );
  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const filteredItems = menuItems.filter((item) => {
    const matchesCategory =
      selectedCategory === "all" || item.category_id === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === "" ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description &&
        item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const getItemQuantity = (itemId: string) =>
    cart.find((c) => c.menuItem.id === itemId)?.quantity || 0;

  const handlePlaceOrder = async () => {
    if (!currentOutlet) return;

    if (!addToOrderId && flowStep !== "review") {
      goToReview();
      return;
    }

    if (cart.length === 0) {
      toast({ variant: "destructive", title: "Cart is empty" });
      return;
    }
    if (orderType === "dine_in" && !selfService && !tableNumber.trim()) {
      toast({ variant: "destructive", title: "Please select a table" });
      return;
    }

    // ── "Add to existing order" mode ────────────────────────────────────────
    if (addToOrderId) {
      try {
        const addBatchId = crypto.randomUUID();
        const newItems = cart.map((item) => ({
          order_id: addToOrderId,
          menu_item_id: item.menuItem.id,
          item_name: item.menuItem.name,
          quantity: item.quantity,
          unit_price: item.menuItem.base_price,
          total_price: item.menuItem.base_price * item.quantity,
          batch_id: addBatchId,
          status: "pending",
          gst_rate: resolveGstRate(item.menuItem.gst_category, currentOutlet?.gst_categories),
        }));

        const { error: itemsError } = await supabase
          .from("order_items")
          .insert(newItems);
        if (itemsError) throw itemsError;

        // Fetch ALL items to re-derive order status
        const { data: allItems } = await supabase
          .from("order_items")
          .select("status")
          .eq("order_id", addToOrderId);

        const activeItems = (allItems || []).filter((i: any) => i.status !== "cancelled");
        let derivedStatus = "pending";
        if (activeItems.length > 0) {
          if (activeItems.some((i: any) => i.status === "pending"))        derivedStatus = "pending";
          else if (activeItems.some((i: any) => i.status === "preparing")) derivedStatus = "preparing";
          else if (activeItems.some((i: any) => i.status === "ready"))     derivedStatus = "ready";
          else derivedStatus = "completed";
        }

        // Fetch current total and update order (total + re-derived status)
        const { data: existingOrder } = await supabase
          .from("orders")
          .select("total, subtotal")
          .eq("id", addToOrderId)
          .single();

        // Fetch order_number for the kitchen slip
        const { data: orderMeta } = await supabase
          .from("orders")
          .select("order_number, total, subtotal")
          .eq("id", addToOrderId)
          .single();

        const newTotal = (orderMeta?.total ?? 0) + cartTotal;
        await supabase
          .from("orders")
          .update({ total: newTotal, subtotal: newTotal, status: derivedStatus })
          .eq("id", addToOrderId);

        const kitchenItems = cart.map((item) => ({
          name: item.menuItem.name,
          quantity: item.quantity,
          totalPrice: item.menuItem.base_price * item.quantity,
          gstRate: resolveGstRate(item.menuItem.gst_category, currentOutlet?.gst_categories),
        }));
        const slipCreatedAt = new Date();

        setLastOrderData({
          outletId: currentOutlet?.id,
          orderNumber: orderMeta?.order_number ?? addToOrderId,
          outletName: currentOutlet?.name ?? "",
          orderType: addToType,
          tableNumber: addToTable || undefined,
          items: cart.map((item) => ({
            name: item.menuItem.name,
            quantity: item.quantity,
            unitPrice: item.menuItem.base_price,
            totalPrice: item.menuItem.base_price * item.quantity,
          })),
          subtotal: cartTotal,
          total: cartTotal,
          createdAt: slipCreatedAt,
        });
        setCart([]);
        setCartDrawerOpen(false);
        setSuccessDialogOpen(true);
        void fireOrderPrint({
          orderNumber: orderMeta?.order_number ?? addToOrderId,
          orderType: addToType,
          tableNumber: addToTable || undefined,
          items: kitchenItems,
          createdAt: slipCreatedAt,
          total: cartTotal,
          source: "pos",
        });
      } catch (error: any) {
        toast({ variant: "destructive", title: "Error", description: error.message });
      }
      return;
    }

    // ── New order ────────────────────────────────────────────────────────────
    try {
      const { data: orderNumData } = await supabase.rpc("generate_order_number", {
        outlet_id: currentOutlet.id,
      });

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          order_number: orderNumData || `${Date.now()}`,
          outlet_id: currentOutlet.id,
          order_type: orderType,
          table_number: orderType === "dine_in" ? tableNumber.trim() : null,
          subtotal: cartTotal,
          total: cartTotal,
          created_by: user?.id,
          status: "pending",
          source: "pos",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const batchId = crypto.randomUUID();
      const orderItems = cart.map((item) => ({
        order_id: order.id,
        menu_item_id: item.menuItem.id,
        item_name: item.menuItem.name,
        quantity: item.quantity,
        unit_price: item.menuItem.base_price,
        total_price: item.menuItem.base_price * item.quantity,
        batch_id: batchId,
        status: "pending",
        gst_rate: resolveGstRate(item.menuItem.gst_category, currentOutlet?.gst_categories),
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      const receiptData: OrderData = {
        outletId: currentOutlet.id,
        orderNumber: order.order_number,
        outletName: currentOutlet.name,
        orderType,
        tableNumber: orderType === "dine_in" ? tableNumber.trim() : undefined,
        items: cart.map((item) => ({
          name: item.menuItem.name,
          quantity: item.quantity,
          unitPrice: item.menuItem.base_price,
          totalPrice: item.menuItem.base_price * item.quantity,
          gstRate: resolveGstRate(item.menuItem.gst_category, currentOutlet?.gst_categories),
        })),
        subtotal: cartTotal,
        total: cartTotal,
        createdAt: new Date(),
      };

      setLastOrderData(receiptData);
      setCartDrawerOpen(false);
      setSuccessDialogOpen(true);
      setCart([]);
      setTableNumber("");
      setFlowStep("type");
      void fireOrderPrint({
        orderNumber: receiptData.orderNumber,
        orderType: receiptData.orderType,
        tableNumber: receiptData.tableNumber,
        items: receiptData.items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          totalPrice: i.totalPrice,
          gstRate: i.gstRate,
        })),
        createdAt: receiptData.createdAt,
        total: receiptData.total,
        source: "pos",
      });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const handleNewOrder = () => {
    setSuccessDialogOpen(false);
    setLastOrderData(null);
    // If we were in add-to-existing mode, go back to orders after dialog closes
    if (addToOrderId) {
      navigate("/orders");
    }
  };

  const handleVoiceResult = (result: VoiceResult) => {
    setOrderType(result.order_type);
    if (result.order_type === "dine_in" && result.table_number) {
      setTableNumber(result.table_number);
    }
    if (!addToOrderId) setFlowStep("menu");
    setCart((prev) => {
      const next = [...prev];
      for (const ri of result.items) {
        const menuItem = menuItems.find((m) => m.id === ri.menu_item_id);
        if (!menuItem) continue;
        const existing = next.find((c) => c.menuItem.id === ri.menu_item_id);
        if (existing) {
          existing.quantity += ri.quantity;
        } else {
          next.push({ menuItem, quantity: ri.quantity });
        }
      }
      return next;
    });
    toast({
      title: "Order captured",
      description: `${result.items.length} item(s) added to cart`,
    });
  };

  if (outletLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (outlets.length === 0) {
    return (
      <AppLayout>
        <div className="p-6 max-w-7xl mx-auto">
          <EmptyState
            icon={ShoppingCart}
            title="No Outlets Found"
            description="Create an outlet first before taking orders"
            actionLabel="Go to Outlets"
            onAction={() => navigate("/outlets")}
          />
        </div>
      </AppLayout>
    );
  }

  if (!addToOrderId && flowStep === "type" && !selfService) {
    return (
      <AppLayout>
        <OrderTypeStep
          outletId={currentOutlet?.id || ""}
          outletName={currentOutlet?.name || ""}
          orderType={orderType}
          onOrderTypeChange={setOrderType}
          tableNumber={tableNumber}
          onTableChange={setTableNumber}
          onContinue={() => setFlowStep("menu")}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Two-column layout on desktop, single column on mobile */}
      <div className="flex flex-col flex-1 min-h-0 lg:overflow-hidden lg:flex-row">

        {/* ── Left: scrollable menu area ── */}
        <div className="flex-1 min-w-0 min-h-0 overflow-y-auto pb-32 lg:pb-4">
          {/* Add-items mode banner */}
          {addToOrderId && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-primary/10 border-b border-primary/20 text-sm font-medium text-primary">
              <PlusCircle className="h-4 w-4 shrink-0" />
              Adding items to{" "}
              {addToType === "dine_in" ? `Table ${addToTable}` : "Takeaway"} order
              <button
                className="ml-auto text-xs underline text-muted-foreground hover:text-foreground"
                onClick={() => navigate("/orders")}
              >
                Cancel
              </button>
            </div>
          )}
          {!addToOrderId && (
            <OrderFlowBar
              flowStep={flowStep === "review" ? "review" : "menu"}
              orderType={orderType}
              tableNumber={tableNumber}
              onChangeType={handleChangeOrderType}
              selfService={selfService}
            />
          )}

          <CategoryTabs
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />

          <div className="p-3 md:p-4 space-y-4">
            {/* Search + Voice Order */}
            <div className="flex flex-col gap-2 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search menu items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <button
                onClick={() => setVoiceOpen(true)}
                className="flex items-center justify-center gap-2 bg-primary text-white font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 active:scale-95 transition-all whitespace-nowrap text-sm shadow-sm md:justify-start"
              >
                <Mic className="h-4 w-4" />
                <span>Voice Order</span>
                <Sparkles className="h-3 w-3 opacity-80" />
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredItems.length === 0 ? (
              <EmptyState
                icon={UtensilsCrossed}
                title="No Items Available"
                description="Add menu items to start taking orders"
                actionLabel="Go to Menu"
                onAction={() => navigate("/menu")}
              />
            ) : (
              <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
                {filteredItems.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    quantity={getItemQuantity(item.id)}
                    onAdd={() => addToCart(item)}
                    onRemove={() => updateQuantity(item.id, -1)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: desktop cart sidebar ── */}
        <div className="hidden lg:flex flex-col w-[360px] shrink-0 border-l border-border/50 bg-card h-full min-h-0 overflow-hidden">
          {/* Sidebar header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 shrink-0">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <h2 className="font-display font-bold text-lg">Order</h2>
              {cartItemsCount > 0 && (
                <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                  {cartItemsCount}
                </span>
              )}
            </div>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Order type + table badge row */}
          <div className="px-5 py-3 border-b border-border/50 flex items-center gap-2 shrink-0">
            <div
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border-2",
                selfService || orderType !== "dine_in"
                  ? "border-orange-400 bg-orange-50 text-orange-600"
                  : "border-primary bg-primary/10 text-primary"
              )}
            >
              {selfService ? (
                <><Store className="h-3.5 w-3.5" /> Self Service</>
              ) : orderType === "dine_in" ? (
                <><Utensils className="h-3.5 w-3.5" /> Dine In</>
              ) : (
                <><Package className="h-3.5 w-3.5" /> Takeaway</>
              )}
            </div>
            {!selfService && orderType === "dine_in" && tableNumber && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border-2 border-primary/30 bg-primary/5 text-primary">
                Table {tableNumber}
              </div>
            )}
            {!selfService && orderType === "dine_in" && !tableNumber && (
              <span className="text-xs text-muted-foreground">
                Select table above
              </span>
            )}
          </div>

          {/* Cart items (scrollable) */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 overscroll-contain">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center">
                  <ShoppingCart className="h-8 w-8 opacity-30" />
                </div>
                <p className="font-medium text-sm">Cart is empty</p>
                <p className="text-xs opacity-70 text-center">
                  Click items from the menu to add them here
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {cart.map((item) => (
                  <div
                    key={item.menuItem.id}
                    className="flex items-center gap-3 py-2.5 border-b border-border/30 last:border-0"
                  >
                    <div
                      className={cn(
                        "w-2.5 h-2.5 rounded-full shrink-0",
                        item.menuItem.is_veg ? "bg-green-500" : "bg-red-500"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.menuItem.name}</p>
                      <p className="text-xs text-primary font-semibold">
                        ₹{item.menuItem.base_price * item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => updateQuantity(item.menuItem.id, -1)}
                        className="h-6 w-6 rounded-full bg-muted flex items-center justify-center hover:bg-muted-foreground/20 transition-colors"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-5 text-center text-sm font-bold">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.menuItem.id, 1)}
                        className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar footer: total + place order — always visible */}
          <div className="border-t border-border/50 p-4 pb-5 bg-card shrink-0 space-y-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Total</span>
              <span className="text-2xl font-bold text-primary">₹{cartTotal}</span>
            </div>
            {addToOrderId || flowStep === "review" ? (
              <Button
                className="w-full h-12 text-base font-semibold gradient-primary glow-primary rounded-xl"
                disabled={cart.length === 0}
                onClick={handlePlaceOrder}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                {addToOrderId ? `Add to Order · ₹${cartTotal}` : `Place Order · ₹${cartTotal}`}
              </Button>
            ) : (
              <Button
                className="w-full h-12 text-base font-semibold gradient-primary glow-primary rounded-xl"
                disabled={cart.length === 0}
                onClick={goToReview}
              >
                Review order · ₹{cartTotal}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile: floating cart bar (hidden when drawer is open) ── */}
      {!cartDrawerOpen && (
        <div className="lg:hidden">
          <CartSummaryBar
            itemCount={cartItemsCount}
            total={cartTotal}
            actionLabel={
              addToOrderId
                ? undefined
                : flowStep === "review"
                  ? "Review & place"
                  : "Review order"
            }
            onViewCart={
              addToOrderId || flowStep === "review"
                ? () => setCartDrawerOpen(true)
                : goToReview
            }
            className="bottom-[68px]"
          />
        </div>
      )}

      <CartDrawer
        open={cartDrawerOpen}
        onOpenChange={setCartDrawerOpen}
        cart={cart}
        orderType={orderType}
        tableNumber={tableNumber}
        outletId={currentOutlet?.id || ""}
        onTableChange={setTableNumber}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeFromCart}
        onPlaceOrder={handlePlaceOrder}
        cartTotal={cartTotal}
        isAddMode={!!addToOrderId}
      />

      <OrderSuccessDialog
        open={successDialogOpen}
        onOpenChange={setSuccessDialogOpen}
        orderData={lastOrderData}
        onNewOrder={handleNewOrder}
        selfService={selfService}
        outletId={currentOutlet?.id}
        outletName={currentOutlet?.name}
      />

      <VoicePOSOrder
        open={voiceOpen}
        onOpenChange={setVoiceOpen}
        menuItems={menuItems}
        onResult={handleVoiceResult}
      />
    </AppLayout>
  );
}

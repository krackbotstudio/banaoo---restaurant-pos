import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/context/cart-context";
import { API_URL } from "@/lib/api-url";
import {
  Plus, Minus, Leaf, Flame, Search, X,
  Mic, MicOff, Loader2, CheckCircle2, AlertCircle, Sparkles, Star,
  ShoppingBag,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

interface Category {
  id: string;
  name: string;
  sort_order: number;
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  image_url: string | null;
  is_veg: boolean;
  is_available: boolean;
  category_id: string | null;
  prep_time_mins: number | null;
  is_special: boolean;
  special_label: string;
  offer_label: string | null;
  offer_price: number | null;
}

interface Outlet {
  id: string;
  name: string;
}

interface RecognizedItem {
  menu_item_id: string;
  name: string;
  quantity: number;
}

type VoiceState = "idle" | "listening" | "processing" | "result" | "error";

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

function VegBadge({ isVeg }: { isVeg: boolean }) {
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
      isVeg ? "border-green-500 text-green-600 bg-green-50" : "border-red-500 text-red-600 bg-red-50"
    }`}>
      {isVeg ? <Leaf className="h-2.5 w-2.5" /> : <Flame className="h-2.5 w-2.5" />}
      {isVeg ? "Veg" : "Non-veg"}
    </span>
  );
}

function ItemCard({ item }: { item: MenuItem }) {
  const { getImageUrl } = useAuth();
  const { items, addItem, updateQty } = useCart();
  const cartItem = items.find((i) => i.menu_item_id === item.id);
  const qty = cartItem?.quantity ?? 0;
  const hasOffer = !!(item.offer_price && item.offer_price < item.base_price);
  const displayPrice = hasOffer ? item.offer_price! : item.base_price;

  return (
    <div className={`bg-white rounded-xl p-3 flex gap-3 shadow-sm border ${
      item.is_special ? "border-amber-200 bg-amber-50/30" : "border-gray-100"
    }`}>
      {item.image_url && (
        <div className="relative flex-shrink-0">
          <img src={getImageUrl(item.image_url)} alt={item.name} className="w-20 h-20 object-cover rounded-lg" />
          {item.is_special && (
            <span className="absolute -top-1.5 -left-1.5 flex items-center gap-0.5 bg-amber-400 text-amber-900 text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow">
              <Star className="h-2 w-2" />
            </span>
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-1 flex-wrap">
          <VegBadge isVeg={item.is_veg} />
          {item.is_special && !item.image_url && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
              <Star className="h-2.5 w-2.5" /> {item.special_label}
            </span>
          )}
          {item.offer_label && (
            <span className="inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-300">
              {item.offer_label}
            </span>
          )}
        </div>
        <h3 className="font-semibold text-sm text-gray-900 mt-0.5 leading-tight">{item.name}</h3>
        {item.description && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>
        )}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-baseline gap-1.5">
            <span className={`font-bold text-sm ${hasOffer ? "text-green-600" : "text-gray-900"}`}>
              ₹{displayPrice.toFixed(0)}
            </span>
            {hasOffer && (
              <span className="text-xs text-gray-400 line-through">₹{item.base_price.toFixed(0)}</span>
            )}
          </div>
          {qty === 0 ? (
            <button
              onClick={() => addItem({ menu_item_id: item.id, name: item.name, unit_price: displayPrice, image_url: item.image_url })}
              className="flex items-center gap-1 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> ADD
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-primary/10 rounded-lg px-1 py-0.5">
              <button onClick={() => updateQty(item.id, qty - 1)} className="w-6 h-6 flex items-center justify-center text-primary hover:bg-primary/20 rounded">
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="text-sm font-bold text-primary w-4 text-center">{qty}</span>
              <button onClick={() => updateQty(item.id, qty + 1)} className="w-6 h-6 flex items-center justify-center text-primary hover:bg-primary/20 rounded">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Specials & Offers horizontal strip ─────────────────────────────────────────
function SpecialsStrip({ items }: { items: MenuItem[] }) {
  const { getImageUrl } = useAuth();
  const { items: cartItems, addItem, updateQty } = useCart();
  const highlights = items.filter((i) => i.is_special || (i.offer_label && i.offer_price));
  if (highlights.length === 0) return null;

  return (
    <div className="px-4 pt-3 pb-1">
      <div className="flex items-center gap-1.5 mb-2">
        <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-400" />
        <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Specials & Offers</span>
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
        {highlights.map((item) => {
          const hasOffer = !!(item.offer_price && item.offer_price < item.base_price);
          const displayPrice = hasOffer ? item.offer_price! : item.base_price;
          const cartItem = cartItems.find((c) => c.menu_item_id === item.id);
          const qty = cartItem?.quantity ?? 0;

          return (
            <div key={item.id} className="flex-shrink-0 w-36 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {item.image_url ? (
                <div className="relative h-24">
                  <img src={getImageUrl(item.image_url)} alt={item.name} className="w-full h-full object-cover" />
                  {/* Overlay badges */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  {item.is_special && (
                    <span className="absolute top-1.5 left-1.5 flex items-center gap-0.5 bg-amber-400 text-amber-900 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      <Star className="h-2 w-2 fill-amber-800" /> {item.special_label}
                    </span>
                  )}
                  {item.offer_label && (
                    <span className="absolute top-1.5 right-1.5 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      {item.offer_label}
                    </span>
                  )}
                </div>
              ) : (
                <div className="h-16 bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center relative">
                  {item.is_special && (
                    <span className="flex items-center gap-0.5 bg-amber-400 text-amber-900 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      <Star className="h-2 w-2 fill-amber-800" /> {item.special_label}
                    </span>
                  )}
                  {item.offer_label && !item.is_special && (
                    <span className="bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      {item.offer_label}
                    </span>
                  )}
                </div>
              )}
              <div className="p-2">
                <p className="text-xs font-semibold text-gray-900 line-clamp-1 leading-tight">{item.name}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <div>
                    <span className={`text-xs font-bold ${hasOffer ? "text-green-600" : "text-gray-900"}`}>
                      ₹{displayPrice.toFixed(0)}
                    </span>
                    {hasOffer && (
                      <span className="text-[10px] text-gray-400 line-through ml-1">₹{item.base_price.toFixed(0)}</span>
                    )}
                  </div>
                  {qty === 0 ? (
                    <button
                      onClick={() => addItem({ menu_item_id: item.id, name: item.name, unit_price: displayPrice, image_url: item.image_url })}
                      className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg"
                    >
                      ADD
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(item.id, qty - 1)} className="w-5 h-5 flex items-center justify-center text-primary bg-primary/10 rounded">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-xs font-bold text-primary">{qty}</span>
                      <button onClick={() => updateQty(item.id, qty + 1)} className="w-5 h-5 flex items-center justify-center text-primary bg-primary/10 rounded">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Voice Order Panel ──────────────────────────────────────────────────────────
function VoiceOrderPanel({ menuItems, onClose }: { menuItems: MenuItem[]; onClose: () => void }) {
  const { items: cartItems, addItem, updateQty } = useCart();
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [liveText, setLiveText] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [recognized, setRecognized] = useState<RecognizedItem[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isSupportedRef = useRef(
    typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
  );

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  }, []);

  const processTranscript = useCallback(
    async (text: string) => {
      setVoiceState("processing");
      setLiveText("");
      setFinalTranscript(text);

      const menuForAI = menuItems.map((i) => ({ id: i.id, name: i.name, price: i.base_price }));

      try {
        const API_URL = import.meta.env.VITE_API_URL ?? "";
        const response = await fetch(`${API_URL}/api/voice-order`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: text, menu_items: menuForAI })
        });
        const data = await response.json();

        if (!response.ok || !data?.items) {
          setErrorMsg("Couldn't understand the order. Please try again.");
          setVoiceState("error");
          return;
        }

        if (data.items.length === 0) {
          setErrorMsg("No matching menu items found. Please try again.");
          setVoiceState("error");
          return;
        }

        setRecognized(data.items);
        setVoiceState("result");
      } catch {
        setErrorMsg("Something went wrong. Please try again.");
        setVoiceState("error");
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

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) { accumulated += result[0].transcript; }
        else { interim += result[0].transcript; }
      }
      setLiveText(accumulated + interim);
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      const text = accumulated.trim();
      if (text) { processTranscript(text); }
      else { setVoiceState("idle"); setLiveText(""); }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "aborted") return;
      if (event.error === "not-allowed") setErrorMsg("Microphone access denied. Please allow mic and retry.");
      else if (event.error === "no-speech") setErrorMsg("No speech detected. Please speak clearly and try again.");
      else setErrorMsg("Voice capture failed. Please try again.");
      setVoiceState("error");
      recognitionRef.current = null;
    };

    recognition.start();
    setVoiceState("listening");
    setLiveText("");
    setFinalTranscript("");
    setRecognized([]);
    setErrorMsg("");
  }, [processTranscript]);

  useEffect(() => {
    if (isSupportedRef.current) { startListening(); }
    else { setErrorMsg("Voice ordering isn't supported on this browser. Use Chrome for best experience."); setVoiceState("error"); }
    return () => stopListening();
  }, []);

  const addToCart = () => {
    for (const ri of recognized) {
      const menuItem = menuItems.find((m) => m.id === ri.menu_item_id);
      if (!menuItem) continue;
      const existing = cartItems.find((c) => c.menu_item_id === ri.menu_item_id);
      const price = menuItem.offer_price && menuItem.offer_price < menuItem.base_price ? menuItem.offer_price : menuItem.base_price;
      if (existing) {
        updateQty(ri.menu_item_id, existing.quantity + ri.quantity);
      } else {
        for (let i = 0; i < ri.quantity; i++) {
          addItem({ menu_item_id: menuItem.id, name: menuItem.name, unit_price: price, image_url: menuItem.image_url });
        }
      }
    }
    onClose();
  };

  const retry = () => {
    setVoiceState("idle"); setLiveText(""); setFinalTranscript(""); setRecognized([]); setErrorMsg("");
    setTimeout(() => startListening(), 100);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={() => { stopListening(); onClose(); }} />
      <div className="fixed bottom-16 left-0 right-0 z-50 max-w-lg mx-auto px-4 pb-4">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-primary to-orange-400 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-white" />
              <span className="text-white font-bold text-sm">AI Voice Order</span>
              <span className="text-[10px] text-white/70 bg-white/20 px-2 py-0.5 rounded-full">Any language</span>
            </div>
            <button onClick={() => { stopListening(); onClose(); }} className="text-white/80 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="px-5 py-5 space-y-4">
            {voiceState === "listening" && (
              <>
                <div className="flex flex-col items-center gap-3 py-2">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-25" />
                    <div className="relative h-14 w-14 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
                      <Mic className="h-7 w-7 text-white" />
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-gray-700">Listening…</p>
                  <p className="text-xs text-gray-400 text-center">Say your order in any language.<br />E.g. "Two butter chicken and one naan"</p>
                </div>
                {liveText && (
                  <div className="bg-gray-50 rounded-2xl px-4 py-3 min-h-[48px]">
                    <p className="text-sm text-gray-700 italic">"{liveText}"</p>
                  </div>
                )}
                <button onClick={() => { stopListening(); setVoiceState("idle"); onClose(); }}
                  className="w-full py-3 rounded-2xl border-2 border-gray-200 text-sm font-semibold text-gray-500 flex items-center justify-center gap-2">
                  <MicOff className="h-4 w-4" /> Cancel
                </button>
              </>
            )}

            {voiceState === "processing" && (
              <div className="flex flex-col items-center gap-3 py-4">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <p className="text-sm font-semibold text-gray-700">Understanding your order…</p>
                {finalTranscript && (
                  <div className="bg-gray-50 rounded-2xl px-4 py-3 w-full">
                    <p className="text-xs text-gray-400 mb-1">You said:</p>
                    <p className="text-sm text-gray-700 italic">"{finalTranscript}"</p>
                  </div>
                )}
              </div>
            )}

            {voiceState === "result" && (
              <>
                {finalTranscript && (
                  <div className="bg-gray-50 rounded-2xl px-4 py-3">
                    <p className="text-xs text-gray-400 mb-1">You said:</p>
                    <p className="text-sm text-gray-700 italic">"{finalTranscript}"</p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Adding to cart</p>
                  <div className="space-y-2">
                    {recognized.map((ri) => (
                      <div key={ri.menu_item_id} className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="text-sm font-semibold text-gray-900">{ri.name}</span>
                        </div>
                        <span className="text-sm font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">×{ri.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={retry} className="flex-1 py-3 rounded-2xl border-2 border-gray-200 text-sm font-semibold text-gray-600">Retry</button>
                  <button onClick={addToCart} className="flex-1 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-bold">Add to Cart</button>
                </div>
              </>
            )}

            {voiceState === "error" && (
              <>
                <div className="flex flex-col items-center gap-3 py-2">
                  <div className="h-14 w-14 rounded-full bg-red-50 border border-red-200 flex items-center justify-center">
                    <AlertCircle className="h-7 w-7 text-red-500" />
                  </div>
                  <p className="text-sm text-center text-gray-700">{errorMsg}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { stopListening(); onClose(); }} className="flex-1 py-3 rounded-2xl border-2 border-gray-200 text-sm font-semibold text-gray-600">Cancel</button>
                  {isSupportedRef.current && (
                    <button onClick={retry} className="flex-1 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-bold">Try Again</button>
                  )}
                </div>
              </>
            )}

            {voiceState === "idle" && (
              <div className="flex flex-col items-center gap-3 py-2">
                <button onClick={startListening} className="h-14 w-14 rounded-full bg-primary flex items-center justify-center shadow-lg">
                  <Mic className="h-7 w-7 text-primary-foreground" />
                </button>
                <p className="text-sm text-gray-500">Tap to start speaking</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/** Sticky bar when cart has items — place order without switching to Cart tab first */
function MenuPlaceOrderBar({ basePath }: { basePath: string }) {
  const navigate = useNavigate();
  const { itemCount, total } = useCart();

  if (itemCount === 0) return null;

  return (
    <div className="fixed bottom-16 left-0 right-0 z-40 max-w-lg mx-auto w-full px-4 pb-2 pointer-events-none">
      <div className="pointer-events-auto bg-white rounded-2xl shadow-lg border border-gray-200 p-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(`${basePath}/cart`)}
          className="flex flex-col items-start justify-center min-w-0 flex-1 px-2 py-1 rounded-xl hover:bg-gray-50 transition-colors text-left"
          aria-label="View cart"
        >
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
            <ShoppingBag className="h-3 w-3" />
            {itemCount} item{itemCount !== 1 ? "s" : ""} in cart
          </span>
          <span className="text-sm font-bold text-gray-900">₹{total.toFixed(0)}</span>
        </button>
        <button
          type="button"
          onClick={() => navigate(`${basePath}/checkout`)}
          className="shrink-0 bg-primary text-primary-foreground font-bold text-sm px-5 py-3.5 rounded-xl hover:bg-primary/90 active:scale-[0.98] transition-all shadow-md"
        >
          Place Order
        </button>
      </div>
    </div>
  );
}

// ── Main MenuPage ──────────────────────────────────────────────────────────────
export default function MenuPage({ outlet, basePath }: { outlet: Outlet; basePath?: string }) {
  const resolvedBase = basePath ?? `/r/${outlet.id}`;
  const { itemCount } = useCart();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [voiceOpen, setVoiceOpen] = useState(false);
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/api/public/outlets/${outlet.id}/menu`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setCategories([]);
          setItems([]);
        } else {
          setCategories(json.categories ?? []);
          setItems(json.items ?? []);
        }
      } catch {
        setCategories([]);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [outlet.id]);

  const filtered = items.filter(
    (i) =>
      (!search || i.name.toLowerCase().includes(search.toLowerCase())) &&
      (activeCategory === "all" || i.category_id === activeCategory)
  );

  const grouped: { category: Category | null; items: MenuItem[] }[] = [];
  if (activeCategory === "all" && !search) {
    categories.forEach((cat) => {
      const catItems = items.filter((i) => i.category_id === cat.id);
      if (catItems.length) grouped.push({ category: cat, items: catItems });
    });
    const uncategorized = items.filter((i) => !i.category_id);
    if (uncategorized.length) grouped.push({ category: null, items: uncategorized });
  }

  const scrollToCategory = (catId: string) => {
    setActiveCategory(catId);
    if (catId !== "all") {
      setTimeout(() => {
        categoryRefs.current[catId]?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
        <p className="text-sm">Menu is not available yet.</p>
      </div>
    );
  }

  return (
    <>
      <div>
        {/* Specials & Offers strip — shown when not searching */}
        {!search && <SpecialsStrip items={items} />}

        {/* Search Bar */}
        <div className="sticky top-0 z-30 bg-gray-50 px-4 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search menu..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); if (e.target.value) setActiveCategory("all"); }}
              className="w-full pl-9 pr-9 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Category Tabs */}
        {!search && categories.length > 0 && (
          <div className="sticky top-[52px] z-30 bg-gray-50 overflow-x-auto scrollbar-none">
            <div className="flex gap-2 px-4 py-2 w-max">
              <button
                onClick={() => scrollToCategory("all")}
                className={`whitespace-nowrap text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                  activeCategory === "all" ? "bg-primary text-primary-foreground" : "bg-white text-gray-600 border border-gray-200"
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => scrollToCategory(cat.id)}
                  className={`whitespace-nowrap text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                    activeCategory === cat.id ? "bg-primary text-primary-foreground" : "bg-white text-gray-600 border border-gray-200"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Menu Items */}
        <div className={`px-4 py-3 space-y-6 ${itemCount > 0 ? "pb-28" : "pb-4"}`}>
          {search || activeCategory !== "all" ? (
            <>
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">No items found</p>
              ) : (
                <div className="space-y-3">
                  {filtered.map((item) => <ItemCard key={item.id} item={item} />)}
                </div>
              )}
            </>
          ) : (
            grouped.map(({ category, items: catItems }) => (
              <div
                key={category?.id ?? "uncategorized"}
                ref={(el) => { if (category) categoryRefs.current[category.id] = el; }}
              >
                <h2 className="font-bold text-sm text-gray-800 mb-3 uppercase tracking-wide">
                  {category?.name ?? "Other"}
                </h2>
                <div className="space-y-3">
                  {catItems.map((item) => <ItemCard key={item.id} item={item} />)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <MenuPlaceOrderBar basePath={resolvedBase} />

      {/* AI Voice Order floating button */}
      {!voiceOpen && (
        <button
          onClick={() => setVoiceOpen(true)}
          className={`fixed right-4 z-30 flex items-center gap-2 bg-primary text-primary-foreground pl-4 pr-5 py-3 rounded-full shadow-lg hover:bg-primary/90 active:scale-95 transition-all ${
            itemCount > 0 ? "bottom-36" : "bottom-20"
          }`}
          title="Voice Order"
        >
          <div className="relative"><Mic className="h-5 w-5" /></div>
          <span className="text-sm font-bold">Order by voice</span>
          <Sparkles className="h-3.5 w-3.5 opacity-80" />
        </button>
      )}

      {voiceOpen && <VoiceOrderPanel menuItems={items} onClose={() => setVoiceOpen(false)} />}
    </>
  );
}

/**
 * Self-contained ordering flow for a single outlet.
 * Used by both BrandApp (after outlet selection) and RestaurantApp (direct outlet link).
 */
import { useEffect, useState } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { CartProvider, useCart } from "@/context/cart-context";
import { useCustomer } from "@/context/customer-context";
import { UtensilsCrossed, ShoppingCart, ClipboardList, Menu as MenuIcon, UserCircle, ChevronLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { InstallAppBanner } from "@/components/customer/InstallAppBanner";
import { useDynamicManifest } from "@/hooks/use-dynamic-manifest";
import MenuPage from "./MenuPage";
import CartPage from "./CartPage";
import CheckoutPage from "./CheckoutPage";
import OrderConfirmedPage from "./OrderConfirmedPage";
import UpiPaymentPage from "./UpiPaymentPage";
import PhoneEntryPage from "./PhoneEntryPage";
import CustomerSetupPage from "./CustomerSetupPage";
import CustomerOrdersPage from "./CustomerOrdersPage";

export interface OutletData {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  opening_time: string | null;
  closing_time: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

// ── Bottom Navigation ─────────────────────────────────────────────────────────
function BottomNav({ basePath }: { basePath: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { itemCount } = useCart();

  const tabs = [
    { label: "Menu", icon: MenuIcon, path: basePath },
    { label: "Cart", icon: ShoppingCart, path: `${basePath}/cart`, badge: itemCount },
    { label: "Orders", icon: ClipboardList, path: `${basePath}/orders` },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex max-w-lg mx-auto w-full">
      {tabs.map(({ label, icon: Icon, path, badge }) => {
        const isActive = location.pathname === path || (path === basePath && location.pathname === `${basePath}/`);
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs font-medium transition-colors ${
              isActive ? "text-primary" : "text-gray-500"
            }`}
          >
            <div className="relative">
              <Icon className="h-5 w-5" />
              {badge != null && badge > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-primary text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </div>
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export interface BrandingProps {
  logo_url?: string | null;
  brand_color?: string | null;
  brand_name?: string | null;
}

// ── App Shell (top bar + routes + bottom nav) ─────────────────────────────────
function AppShell({
  outlet,
  basePath,
  onChangeOutlet,
  branding,
}: {
  outlet: OutletData;
  basePath: string;
  onChangeOutlet?: () => void;
  branding?: BrandingProps;
}) {
  const { customer, clearCustomer } = useCustomer();
  const { getImageUrl } = useAuth();
  const navigate = useNavigate();
  const accentColor = branding?.brand_color || undefined;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      {/* PWA Install Banner — persists until app is installed */}
      <InstallAppBanner restaurantName={branding?.brand_name || outlet.name} />

      {/* Top App Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 px-3 py-3">
          {onChangeOutlet && (
            <button onClick={onChangeOutlet} className="p-1.5 rounded-lg hover:bg-gray-100 flex-shrink-0">
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
          )}
          {!onChangeOutlet && (
            branding?.logo_url ? (
              <img
                src={getImageUrl(branding.logo_url)}
                alt="Logo"
                className="h-9 w-9 rounded-lg object-contain flex-shrink-0"
              />
            ) : (
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0 bg-primary"
                style={accentColor ? { backgroundColor: accentColor } : undefined}
              >
                <UtensilsCrossed className="h-5 w-5 text-white" />
              </div>
            )
          )}
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-base text-gray-900 truncate">{outlet.name}</h1>
            {outlet.address && <p className="text-xs text-gray-500 truncate">{outlet.address}</p>}
          </div>
          {customer && (
            <button
              onClick={() => navigate(`${basePath}/profile`)}
              className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-100 rounded-full px-3 py-1.5 flex-shrink-0"
            >
              <UserCircle className="h-4 w-4" />
              <span className="max-w-[70px] truncate">{customer.name || customer.phone}</span>
            </button>
          )}
        </div>
      </header>

      {/* Routes */}
      <main className="flex-1 pb-16 overflow-y-auto">
        <Routes>
          <Route index element={<MenuPage outlet={outlet} basePath={basePath} />} />
          <Route path="cart" element={<CartPage outlet={outlet} />} />
          <Route path="checkout" element={<CheckoutPage outlet={outlet} basePath={basePath} />} />
          <Route path="payment/:orderId" element={<UpiPaymentPage outlet={outlet} basePath={basePath} />} />
          <Route path="confirmed" element={<OrderConfirmedPage outlet={outlet} basePath={basePath} />} />
          <Route path="orders" element={<CustomerOrdersPage outletId={outlet.id} />} />
          <Route
            path="profile"
            element={
              <ProfilePage
                outlet={outlet}
                basePath={basePath}
                onClear={() => { clearCustomer(); navigate(basePath); }}
              />
            }
          />
        </Routes>
      </main>

      <BottomNav basePath={basePath} />
    </div>
  );
}

function ProfilePage({
  outlet,
  basePath,
  onClear,
}: {
  outlet: OutletData;
  basePath: string;
  onClear: () => void;
}) {
  const { customer } = useCustomer();
  const navigate = useNavigate();
  const defaultAddr = customer?.customer_addresses?.find((a) => a.is_default);

  return (
    <div className="px-4 py-5 space-y-4">
      <h2 className="font-bold text-base text-gray-900">Your Profile</h2>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        <div className="px-4 py-3">
          <p className="text-xs text-gray-400">Name</p>
          <p className="font-semibold text-gray-900">{customer?.name || "—"}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-gray-400">Mobile</p>
          <p className="font-semibold text-gray-900">{customer?.phone || "—"}</p>
        </div>
        {defaultAddr && (
          <div className="px-4 py-3">
            <p className="text-xs text-gray-400">Saved Address ({defaultAddr.label})</p>
            <p className="text-sm text-gray-700 mt-0.5">{defaultAddr.address_text}</p>
          </div>
        )}
      </div>
      <button onClick={onClear} className="w-full text-sm text-red-500 font-semibold py-3 border-2 border-red-100 rounded-2xl">
        Sign out / Switch account
      </button>
      <button onClick={() => navigate(-1)} className="w-full text-sm text-gray-600 font-semibold py-3 bg-gray-100 rounded-2xl">
        Back to Menu
      </button>
    </div>
  );
}

// ── Customer identification gate ──────────────────────────────────────────────
type CustomerStep = "phone" | "setup" | "ready";

export function OutletOrderingFlow({
  outlet,
  basePath,
  onChangeOutlet,
  branding,
}: {
  outlet: OutletData;
  basePath: string;
  onChangeOutlet?: () => void;
  branding?: BrandingProps;
}) {
  const { customer } = useCustomer();
  const [step, setStep] = useState<CustomerStep>(customer ? "ready" : "phone");
  const [pendingPhone, setPendingPhone] = useState("");

  useEffect(() => {
    if (customer && step !== "ready") setStep("ready");
  }, [customer]);

  const restaurantName = branding?.brand_name || outlet.name;

  useDynamicManifest({
    name: restaurantName,
    startUrl: basePath,
    themeColor: branding?.brand_color || "#f97316",
  });

  if (step === "phone") {
    return (
      <>
        <InstallAppBanner restaurantName={restaurantName} />
        <PhoneEntryPage
          outlet={outlet}
          onCustomerReady={() => setStep("ready")}
          onNeedSetup={(phone) => { setPendingPhone(phone); setStep("setup"); }}
        />
      </>
    );
  }

  if (step === "setup") {
    return (
      <>
        <InstallAppBanner restaurantName={restaurantName} />
        <CustomerSetupPage phone={pendingPhone} onDone={() => setStep("ready")} />
      </>
    );
  }

  return (
    <CartProvider outletId={outlet.id}>
      <AppShell outlet={outlet} basePath={basePath} onChangeOutlet={onChangeOutlet} branding={branding} />
    </CartProvider>
  );
}

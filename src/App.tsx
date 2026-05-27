import { Suspense, lazy } from "react";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SupportChatWidget } from "@/components/support";
import { CookieConsent } from "@/components/CookieConsent";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { OutletProvider } from "@/lib/outlet-context";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AffiliateLayout } from "@/components/affiliate/AffiliateLayout";
import { AffiliateProtectedRoute } from "@/components/affiliate/AffiliateProtectedRoute";
import { ThemeProvider } from "@/lib/theme";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Loader2 } from "lucide-react";

// Lazy-loaded pages for code splitting
const Landing = lazy(() => import("./pages/Landing"));
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Outlets = lazy(() => import("./pages/Outlets"));
const OutletDetail = lazy(() => import("./pages/OutletDetail"));
const Menu = lazy(() => import("./pages/Menu"));
const Orders = lazy(() => import("./pages/Orders"));
const NewOrder = lazy(() => import("./pages/NewOrder"));
const Kitchen = lazy(() => import("./pages/Kitchen"));
const Payments = lazy(() => import("./pages/Payments"));
const BillingCheckout = lazy(() => import("./pages/BillingCheckout"));
const Staff = lazy(() => import("./pages/Staff"));
const About = lazy(() => import("./pages/About"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Refund = lazy(() => import("./pages/Refund"));
const Shipping = lazy(() => import("./pages/Shipping"));
const Docs = lazy(() => import("./pages/Docs"));
const DocsArticle = lazy(() => import("./pages/DocsArticle"));
const Affiliate = lazy(() => import("./pages/Affiliate"));
const AffiliateAuth = lazy(() => import("./pages/affiliate/AffiliateAuth"));
const AffiliateDashboard = lazy(() => import("./pages/affiliate/AffiliateDashboard"));
const AffiliateReferrals = lazy(() => import("./pages/affiliate/AffiliateReferrals"));
const AffiliateCommissions = lazy(() => import("./pages/affiliate/AffiliateCommissions"));
const AffiliatePayouts = lazy(() => import("./pages/affiliate/AffiliatePayouts"));
const AffiliateMarketing = lazy(() => import("./pages/affiliate/AffiliateMarketing"));
const AffiliateSettings = lazy(() => import("./pages/affiliate/AffiliateSettings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const QRMenuBuilder = lazy(() => import("./pages/tools/QRMenuBuilder"));
const MenuViewer = lazy(() => import("./pages/tools/MenuViewer"));
const SavedMenuViewer = lazy(() => import("./pages/tools/SavedMenuViewer"));
const MyMenus = lazy(() => import("./pages/tools/MyMenus"));
const Settings = lazy(() => import("./pages/Settings"));
const Addons = lazy(() => import("./pages/Addons"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Integrations = lazy(() => import("./pages/Integrations"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const OrderHistory = lazy(() => import("./pages/OrderHistory"));
const Customers = lazy(() => import("./pages/Customers"));
const Analytics = lazy(() => import("./pages/Analytics"));
const RestaurantApp = lazy(() => import("./pages/customer/RestaurantApp"));
const BrandApp = lazy(() => import("./pages/customer/BrandApp"));
const StaffLogin = lazy(() => import("./pages/StaffLogin"));
const AccountPending = lazy(() => import("./pages/AccountPending"));
const AdminAccounts = lazy(() => import("./pages/admin/Accounts"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const App = () => (
  <HelmetProvider>
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OutletProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner position="top-right" />
            <SupportChatWidget />
            <BrowserRouter>
              <CookieConsent />
              <ErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Public routes */}
                  <Route path="/" element={<Landing />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/pricing" element={<Pricing />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/refund" element={<Refund />} />
                  <Route path="/shipping" element={<Shipping />} />
                  <Route path="/docs" element={<Docs />} />
                  <Route path="/docs/:slug" element={<DocsArticle />} />
                  <Route path="/affiliate" element={<Affiliate />} />
                  <Route path="/affiliate/auth" element={<AffiliateAuth />} />

                  {/* Staff login (separate from owner auth) */}
                  <Route path="/staff-login" element={<StaffLogin />} />

                  {/* Tools */}
                  <Route path="/tools/qr-menu-builder" element={<QRMenuBuilder />} />
                  <Route path="/m/:menuData" element={<MenuViewer />} />
                  <Route path="/menu/:slug" element={<SavedMenuViewer />} />

                  {/* Customer-facing ordering app */}
                  <Route path="/order/:slug/*" element={<BrandApp />} />
                  <Route path="/r/:outletId/*" element={<RestaurantApp />} />

                  {/* OAuth callback — silent redirect handler, no landing page */}
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/billing/checkout" element={<ProtectedRoute><BillingCheckout /></ProtectedRoute>} />

                  {/* Account pending — requires auth, exempt from all checks */}
                  <Route path="/account-pending" element={<ProtectedRoute><AccountPending /></ProtectedRoute>} />

                  {/* Admin routes */}
                  <Route path="/admin/account" element={<Navigate to="/admin/accounts" replace />} />
                  <Route path="/admin/accounts" element={<ProtectedRoute><AdminAccounts /></ProtectedRoute>} />

                  {/* Affiliate portal */}
                  <Route
                    path="/affiliate"
                    element={
                      <AffiliateProtectedRoute>
                        <AffiliateLayout />
                      </AffiliateProtectedRoute>
                    }
                  >
                    <Route path="dashboard" element={<AffiliateDashboard />} />
                    <Route path="referrals" element={<AffiliateReferrals />} />
                    <Route path="commissions" element={<AffiliateCommissions />} />
                    <Route path="payouts" element={<AffiliatePayouts />} />
                    <Route path="marketing" element={<AffiliateMarketing />} />
                    <Route path="settings" element={<AffiliateSettings />} />
                  </Route>

                  {/* Protected routes */}
                  <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
                  <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                  <Route path="/outlets" element={<ProtectedRoute><Outlets /></ProtectedRoute>} />
                  <Route path="/outlets/:id" element={<ProtectedRoute><OutletDetail /></ProtectedRoute>} />
                  <Route path="/menu" element={<ProtectedRoute><Menu /></ProtectedRoute>} />
                  <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
                  <Route path="/orders/new" element={<ProtectedRoute><NewOrder /></ProtectedRoute>} />
                  <Route path="/kitchen" element={<ProtectedRoute><Kitchen /></ProtectedRoute>} />
                  <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
                  <Route path="/staff" element={<ProtectedRoute><Staff /></ProtectedRoute>} />
                  <Route path="/my-menus" element={<ProtectedRoute><MyMenus /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                  <Route path="/addons" element={<ProtectedRoute><Addons /></ProtectedRoute>} />
                  <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
                  <Route path="/integrations" element={<ProtectedRoute><Integrations /></ProtectedRoute>} />
                  <Route path="/order-history" element={<ProtectedRoute><OrderHistory /></ProtectedRoute>} />
                  <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
                  <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
              </ErrorBoundary>
            </BrowserRouter>
          </TooltipProvider>
        </OutletProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
  </HelmetProvider>
);

export default App;

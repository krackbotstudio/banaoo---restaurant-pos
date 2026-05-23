import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { useSubscription } from "@/hooks/use-subscription";
import { useFeatureGating } from "@/hooks/use-feature-gating";
import { LimitIndicator } from "@/components/FeatureGate";
import {
  BILLING_PERIOD_MONTHS,
  DEFAULT_BILLING_PERIOD_MONTHS,
  DISCOUNTS,
  billingPeriodLabel,
  calcPlanTotal,
  calcPlanSavings,
  getPlanDisplayName,
  type PaidPlanId,
} from "@/lib/plans";
import { useNotifications } from "@/hooks/use-notifications";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  User,
  CreditCard,
  Bell,
  Shield,
  LogOut,
  Crown,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
  Trash2,
  Palette,
  Upload,
  Sun,
  Moon,
  ImageIcon,
  Building2,
  Check,
  Store,
  MapPin,
  Phone,
  Plus,
  ChefHat,
  Printer,
  Bluetooth,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useOutlet } from "@/lib/outlet-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isNativePrinterBridgeExpected, openNativePrinterSettings } from "@/lib/native-print-bridge";
import { isBanaooNativeApp, openBillingSettingsInBrowser } from "@/lib/native-app-bridge";
import { PrinterFleetSettings } from "@/components/printers/PrinterFleetSettings";
import { CustomerOrderingLinkCard } from "@/components/customer/CustomerOrderingLinkCard";
import { UpiQrUpload } from "@/components/payments/UpiQrUpload";

export default function Settings() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, signOut, refreshProfile, getImageUrl } = useAuth();
  const {
    subscription,
    loading: subLoading,
    hasActiveSubscription,
    expiresAt,
    daysUntilExpiry,
    createOrder,
    cancelSubscription,
    isNativeAppBilling,
  } = useSubscription();
  const { isWithinLimit, usage, getUpgradeMessage } = useFeatureGating();
  const { 
    notifications, 
    unreadCount, 
    loading: notifLoading, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification, 
    clearAll 
  } = useNotifications();
  
  const { theme, setTheme } = useTheme();
  const { currentOutlet, outlets, setCurrentOutlet, canSwitchOutlets } = useOutlet();
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get("tab") || "profile";
    if (isBanaooNativeApp() && tab === "subscription") return "profile";
    return tab;
  });

  const handleSettingsTabChange = (nextTab: string) => {
    if (isNativeAppBilling && nextTab === "subscription") {
      void openBillingSettingsInBrowser("subscription").catch((err) => {
        toast.error(err instanceof Error ? err.message : "Could not open browser");
      });
      return;
    }
    setActiveTab(nextTab);
    if (nextTab === "outlets") void fetchOutletsList();
  };

  // Subscription / plan state
  const [planMonths, setPlanMonths] = useState(DEFAULT_BILLING_PERIOD_MONTHS);
  const [payingPlan, setPayingPlan] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [openingNativePrinters, setOpeningNativePrinters] = useState(false);

  const handlePay = async (planId: PaidPlanId) => {
    setPayingPlan(planId);
    try {
      await createOrder(planId, planMonths);
    } finally {
      setPayingPlan(null);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    await cancelSubscription();
    setCancelling(false);
  };

  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [businessType, setBusinessType] = useState(profile?.business_type || "");
  const [saving, setSaving] = useState(false);

  // Branding state
  const [brandName, setBrandName] = useState(profile?.brand_name || "");
  const [brandColor, setBrandColor] = useState(profile?.brand_color || "#f97316");
  const [logoPreview, setLogoPreview] = useState<string | null>(profile?.logo_url || null);
  const [savingBranding, setSavingBranding] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [upiVpa, setUpiVpa] = useState((profile as { upi_vpa?: string })?.upi_vpa || "");
  const [upiDisplayName, setUpiDisplayName] = useState((profile as { upi_display_name?: string })?.upi_display_name || "");
  const [upiQrUrl, setUpiQrUrl] = useState((profile as { upi_qr_url?: string })?.upi_qr_url || "");
  const [onlinePaymentsEnabled, setOnlinePaymentsEnabled] = useState(
    (profile as { online_payments_enabled?: boolean })?.online_payments_enabled !== false
  );

  // ── Outlets tab state ───────────────────────────────────────────────────────
  interface OutletItem { id: string; name: string; address: string | null; phone: string | null; is_active: boolean; }
  const API_URL = import.meta.env.VITE_API_URL ?? "";
  const [outletsList, setOutletsList] = useState<OutletItem[]>([]);
  const [outletsLoading, setOutletsLoading] = useState(false);
  const [addOutletOpen, setAddOutletOpen] = useState(false);
  const [addOutletSubmitting, setAddOutletSubmitting] = useState(false);
  const [newOutletName, setNewOutletName] = useState("");
  const [newOutletAddress, setNewOutletAddress] = useState("");
  const [newOutletPhone, setNewOutletPhone] = useState("");
  const [deleteOutletDialogOpen, setDeleteOutletDialogOpen] = useState(false);
  const [outletToDelete, setOutletToDelete] = useState<OutletItem | null>(null);
  const [deleteOutletPassword, setDeleteOutletPassword] = useState("");
  const [deleteOutletError, setDeleteOutletError] = useState("");
  const [isDeletingOutlet, setIsDeletingOutlet] = useState(false);

  useEffect(() => {
    if (searchParams.get("tab") === "outlets") fetchOutletsList();
    if (isNativeAppBilling && searchParams.get("tab") === "subscription") {
      void openBillingSettingsInBrowser("subscription").catch((err) => {
        toast.error(err instanceof Error ? err.message : "Could not open browser");
      });
      navigate("/settings?tab=profile", { replace: true });
    }
  }, []);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
      setBusinessType(profile.business_type || "");
      setBrandName(profile.brand_name || "");
      setBrandColor(profile.brand_color || "#f97316");
      setLogoPreview(profile.logo_url || null);
      setUpiVpa(profile.upi_vpa || "");
      setUpiDisplayName(profile.upi_display_name || "");
      setUpiQrUrl(profile.upi_qr_url || "");
      setOnlinePaymentsEnabled(profile.online_payments_enabled !== false);
    }
  }, [profile]);

  const handleUpdateProfile = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/profile`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, phone: phone || null, business_type: businessType || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to update profile");
      await refreshProfile();
      toast.success("Profile updated successfully");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update profile";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const API_URL = import.meta.env.VITE_API_URL ?? "";
      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();

      const saveRes = await fetch(`${API_URL}/api/profile`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo_url: data.url }),
      });
      if (!saveRes.ok) throw new Error("Failed to save logo");

      setLogoPreview(data.url);
      await refreshProfile();
      toast.success("Logo uploaded!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveBranding = async () => {
    if (!user) return;
    setSavingBranding(true);
    try {
      const res = await fetch(`${API_URL}/api/profile`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_name: brandName || null,
          brand_color: brandColor,
          upi_vpa: upiVpa.trim() || null,
          upi_display_name: upiDisplayName.trim() || null,
          upi_qr_url: upiQrUrl.trim() || null,
          online_payments_enabled: onlinePaymentsEnabled,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to save branding");
      await refreshProfile();
      toast.success("Branding saved!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save branding");
    } finally {
      setSavingBranding(false);
    }
  };

  // ── Outlets tab functions ───────────────────────────────────────────────────
  const fetchOutletsList = async () => {
    setOutletsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/outlets`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to load outlets");
      setOutletsList((data as { outlets: OutletItem[] }).outlets || []);
    } catch {
      setOutletsList([]);
    }
    setOutletsLoading(false);
  };

  const handleAddOutlet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOutletName.trim()) return;
    if (!isWithinLimit("outlets", usage.outlets)) {
      toast.error(getUpgradeMessage("outlets"));
      navigate("/addons");
      return;
    }
    setAddOutletSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/outlets`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newOutletName.trim(), address: newOutletAddress.trim() || null, phone: newOutletPhone.trim() || null }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((payload as { error?: string }).error || "Could not create outlet");
      toast.success("Outlet created!");
      setNewOutletName(""); setNewOutletAddress(""); setNewOutletPhone("");
      setAddOutletOpen(false);
      fetchOutletsList();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create outlet");
    }
    setAddOutletSubmitting(false);
  };

  const handleDeleteOutlet = async () => {
    if (!outletToDelete || !user || !deleteOutletPassword) {
      setDeleteOutletError("Please enter your password");
      return;
    }
    setIsDeletingOutlet(true);
    setDeleteOutletError("");
    try {
      const { error: authError } = await (useAuth as any).signIn
        ? { error: null }
        : { error: null };
      // Re-authenticate using supabase directly
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user.email!, password: deleteOutletPassword });
      if (signInErr) { setDeleteOutletError("Incorrect password. Please try again."); setIsDeletingOutlet(false); return; }
      const delRes = await fetch(`${API_URL}/api/outlets/${outletToDelete.id}`, { method: "DELETE", credentials: "include" });
      const delPayload = await delRes.json().catch(() => ({}));
      if (!delRes.ok) throw new Error((delPayload as { error?: string }).error || "Failed to delete outlet");
      toast.success(`"${outletToDelete.name}" deleted permanently`);
      setDeleteOutletDialogOpen(false);
      setOutletToDelete(null);
      setDeleteOutletPassword("");
      fetchOutletsList();
    } catch (err: unknown) {
      setDeleteOutletError(err instanceof Error ? err.message : "Failed to delete outlet");
    }
    setIsDeletingOutlet(false);
  };

  const handleThemeChange = async (newTheme: "light" | "dark") => {
    setTheme(newTheme);
    if (user) {
      await fetch(`${API_URL}/api/profile`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_theme: newTheme }),
      });
    }
  };

  const getPlanDisplay = () => getPlanDisplayName(subscription?.plan_type);

  const getStatusBadge = () => {
    if (!subscription) return null;
    if (hasActiveSubscription) {
      return <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" />Active</Badge>;
    }
    return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Expired</Badge>;
  };

  return (
    <AppLayout>
      <div className="container max-w-4xl py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your account settings and preferences
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={handleSettingsTabChange}
          className="space-y-6"
        >
          <div className="sm:hidden sticky top-14 z-40 border-b border-border bg-background/95 py-3 px-3 shadow-sm backdrop-blur-sm supports-[backdrop-filter]:bg-background/85">
            <Select value={activeTab} onValueChange={handleSettingsTabChange}>
              <SelectTrigger className="h-11 min-h-[44px] w-full rounded-lg border-border bg-background text-left font-medium">
                <SelectValue placeholder="Select settings section" />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={8} className="max-h-[min(70vh,420px)]">
                <SelectItem value="profile">Profile</SelectItem>
                <SelectItem value="outlets">Outlets</SelectItem>
                <SelectItem value="branding">Branding</SelectItem>
                {!isNativeAppBilling && <SelectItem value="subscription">Subscription</SelectItem>}
                <SelectItem value="notifications">Notifications</SelectItem>
                <SelectItem value="preferences">Security</SelectItem>
                <SelectItem value="printers">Printers</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <TabsList
            className={`hidden h-auto min-h-12 w-full gap-1.5 p-1.5 sm:grid ${
              isNativeAppBilling ? "sm:grid-cols-6" : "sm:grid-cols-7"
            }`}
          >
            <TabsTrigger value="profile" className="gap-1.5 px-2 py-2.5 sm:px-3">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="outlets" className="gap-1.5 px-2 py-2.5 sm:px-3" onClick={fetchOutletsList}>
              <Store className="h-4 w-4" />
              <span className="hidden sm:inline">Outlets</span>
            </TabsTrigger>
            <TabsTrigger value="branding" className="gap-1.5 px-2 py-2.5 sm:px-3">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Branding</span>
            </TabsTrigger>
            {!isNativeAppBilling && (
              <TabsTrigger value="subscription" className="gap-1.5 px-2 py-2.5 sm:px-3">
                <CreditCard className="h-4 w-4" />
                <span className="hidden sm:inline">Subscription</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="notifications" className="relative gap-1.5 px-2 py-2.5 sm:px-3">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notifications</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="preferences" className="gap-1.5 px-2 py-2.5 sm:px-3">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
            <TabsTrigger value="printers" className="gap-1.5 px-2 py-2.5 sm:px-3">
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Printers</span>
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profile Information
                </CardTitle>
                <CardDescription>
                  Update your personal information and contact details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Contact support to change your email address
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Enter your phone number"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="businessType">Business Type</Label>
                  <Select value={businessType} onValueChange={setBusinessType}>
                    <SelectTrigger id="businessType">
                      <SelectValue placeholder="Select your business type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="restaurant">Restaurant — Dine-in & takeaway</SelectItem>
                      <SelectItem value="hotel">Hotel — Hotel dining & room service</SelectItem>
                      <SelectItem value="cloud_kitchen">Cloud Kitchen — Delivery-only kitchen</SelectItem>
                      <SelectItem value="cafe">Cafe — Coffee shop & cafe</SelectItem>
                      <SelectItem value="qsr">QSR — Quick service restaurant</SelectItem>
                      <SelectItem value="bar">Bar & Lounge — Bar, pub & lounge</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Role</Label>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="capitalize">
                      {profile?.role || "Owner"}
                    </Badge>
                  </div>
                </div>

                <Button onClick={handleUpdateProfile} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Changes

                </Button>
              </CardContent>
            </Card>

            {isNativeAppBilling && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    Subscription & billing
                  </CardTitle>
                  <CardDescription>
                    Renew or change your plan in your browser (required for Play Store billing). Add-ons
                    stay in the app under Add-ons.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      void openBillingSettingsInBrowser("subscription").catch((err) => {
                        toast.error(err instanceof Error ? err.message : "Could not open browser");
                      });
                    }}
                  >
                    Manage subscription in browser
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/addons">Add-ons</Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <Shield className="h-5 w-5" />
                  Danger Zone
                </CardTitle>
                <CardDescription>
                  Irreversible account actions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Sign out of all devices</p>
                    <p className="text-sm text-muted-foreground">
                      This will sign you out from your current session
                    </p>
                  </div>
                  <Button variant="outline" onClick={signOut}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Button>
                </div>
              </CardContent>
            </Card>

          </TabsContent>

          {/* Outlets Tab */}
          <TabsContent value="outlets" className="space-y-6">
            {/* Active outlet selector — only when user has multiple outlets */}
            {canSwitchOutlets && outlets.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Active Outlet
                  </CardTitle>
                  <CardDescription>
                    All pages (orders, menu, analytics, etc.) show data for the selected outlet. Use a different device per outlet for the best experience.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {outlets.map((outlet) => (
                    <button
                      key={outlet.id}
                      type="button"
                      onClick={() => setCurrentOutlet(outlet)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-all ${
                        currentOutlet?.id === outlet.id
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:border-primary/40 hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Building2 className="h-4 w-4 shrink-0" />
                        <span className="font-medium">{outlet.name}</span>
                      </div>
                      {currentOutlet?.id === outlet.id && (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      )}
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}

            {currentOutlet && (
              <CustomerOrderingLinkCard
                outletId={currentOutlet.id}
                outletName={currentOutlet.name}
                brandName={profile?.brand_name}
                orderingSlug={profile?.ordering_slug}
                manageHref={`/outlets/${currentOutlet.id}`}
              />
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Store className="h-5 w-5" />
                      Your Outlets
                    </CardTitle>
                    <CardDescription>
                      Manage your restaurant locations — add, view details, or delete outlets
                    </CardDescription>
                    <LimitIndicator feature="outlets" currentCount={usage.outlets} label="Outlets" />
                  </div>
                  <Button
                    className="gradient-primary glow-primary shrink-0"
                    onClick={() => {
                      if (!isWithinLimit("outlets", usage.outlets)) {
                        toast.error(getUpgradeMessage("outlets"));
                        navigate("/addons");
                        return;
                      }
                      setAddOutletOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Outlet
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {outletsLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-7 w-7 animate-spin text-primary" />
                  </div>
                ) : outletsList.length === 0 ? (
                  <div className="text-center py-10 space-y-3">
                    <div className="mx-auto w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                      <Store className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <p className="font-medium">No outlets yet</p>
                    <p className="text-sm text-muted-foreground">Add your first restaurant location to get started</p>
                    <Button onClick={() => setAddOutletOpen(true)} className="gradient-primary">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Outlet
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {outletsList.map((outlet) => (
                      <div key={outlet.id} className="relative group rounded-xl border border-border hover:border-primary/40 transition-all overflow-hidden">
                        <Link to={`/outlets/${outlet.id}`} className="block p-4 pr-10">
                          <div className="flex items-start gap-3">
                            <div className="p-2.5 rounded-lg gradient-primary shrink-0">
                              <ChefHat className="h-4 w-4 text-primary-foreground" />
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold truncate">{outlet.name}</p>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                                  outlet.is_active ? "bg-green-500/15 text-green-600" : "bg-muted text-muted-foreground"
                                }`}>
                                  {outlet.is_active ? "Active" : "Inactive"}
                                </span>
                              </div>
                              {outlet.address && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                                  <MapPin className="h-3 w-3 shrink-0" />{outlet.address}
                                </p>
                              )}
                              {outlet.phone && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Phone className="h-3 w-3 shrink-0" />{outlet.phone}
                                </p>
                              )}
                              <p className="text-xs text-primary font-medium mt-1">Tap to manage →</p>
                            </div>
                          </div>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => {
                            setOutletToDelete(outlet);
                            setDeleteOutletPassword("");
                            setDeleteOutletError("");
                            setDeleteOutletDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Add Outlet Dialog */}
          <Dialog open={addOutletOpen} onOpenChange={setAddOutletOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display">Add New Outlet</DialogTitle>
                <DialogDescription>Create a new restaurant location</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddOutlet} className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label>Outlet Name *</Label>
                  <Input placeholder="e.g. Main Branch, Downtown" value={newOutletName} onChange={(e) => setNewOutletName(e.target.value)} className="h-11" autoFocus />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Textarea placeholder="Full address" value={newOutletAddress} onChange={(e) => setNewOutletAddress(e.target.value)} rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input type="tel" placeholder="Contact number" value={newOutletPhone} onChange={(e) => setNewOutletPhone(e.target.value)} className="h-11" />
                </div>
                <Button type="submit" className="w-full h-11 gradient-primary" disabled={addOutletSubmitting}>
                  {addOutletSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Outlet"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* Delete Outlet Dialog */}
          <AlertDialog open={deleteOutletDialogOpen} onOpenChange={setDeleteOutletDialogOpen}>
            <AlertDialogContent className="max-w-md">
              <AlertDialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-full bg-destructive/10">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <AlertDialogTitle>Delete Outlet Permanently?</AlertDialogTitle>
                </div>
                <AlertDialogDescription asChild>
                  <div className="space-y-4">
                    <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg space-y-2">
                      <p className="font-semibold text-destructive text-sm">⚠️ This cannot be undone!</p>
                      <p className="text-sm text-muted-foreground">
                        Deleting <span className="font-semibold text-foreground">"{outletToDelete?.name}"</span> will permanently remove all menu items, orders, staff assignments, and associated data.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Enter your password to confirm</Label>
                      <Input
                        type="password"
                        placeholder="Your account password"
                        value={deleteOutletPassword}
                        onChange={(e) => { setDeleteOutletPassword(e.target.value); setDeleteOutletError(""); }}
                        className={deleteOutletError ? "border-destructive" : ""}
                      />
                      {deleteOutletError && <p className="text-sm text-destructive">{deleteOutletError}</p>}
                    </div>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2">
                <Button variant="outline" onClick={() => { setDeleteOutletDialogOpen(false); setOutletToDelete(null); setDeleteOutletPassword(""); setDeleteOutletError(""); }} disabled={isDeletingOutlet}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDeleteOutlet} disabled={isDeletingOutlet || !deleteOutletPassword} className="gap-2">
                  {isDeletingOutlet ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Trash2 className="h-4 w-4" />Delete Permanently</>}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Branding Tab */}
          <TabsContent value="branding" className="space-y-6">
            {/* Restaurant Logo & Name */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Restaurant Identity
                </CardTitle>
                <CardDescription>
                  Your logo and name appear in the admin sidebar and on your online ordering page
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Logo Upload */}
                <div className="space-y-3">
                  <Label>Restaurant Logo</Label>
                  <div className="flex items-center gap-4">
                    <div className="h-20 w-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden shrink-0">
                      {logoPreview ? (
                        <img src={getImageUrl(logoPreview)} alt="Logo" className="h-full w-full object-contain" />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="logo-upload" className="cursor-pointer">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-input bg-background hover:bg-accent text-sm font-medium transition-colors">
                          {uploadingLogo ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                          {uploadingLogo ? "Uploading…" : "Upload Logo"}
                        </div>
                        <input
                          id="logo-upload"
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/svg+xml"
                          className="sr-only"
                          onChange={handleLogoUpload}
                          disabled={uploadingLogo}
                        />
                      </label>
                      <p className="text-xs text-muted-foreground">PNG, JPG, WebP or SVG · max 2 MB</p>
                      {logoPreview && (
                        <button
                          type="button"
                          className="text-xs text-destructive hover:underline"
                          onClick={async () => {
                            await fetch(`${API_URL}/api/profile`, {
                              method: "PUT",
                              credentials: "include",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ logo_url: null }),
                            });
                            setLogoPreview(null);
                            await refreshProfile();
                          }}
                        >
                          Remove logo
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Brand Name */}
                <div className="space-y-2">
                  <Label htmlFor="brandName">Restaurant / Brand Name</Label>
                  <Input
                    id="brandName"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="e.g. Spice Garden, The Burger Hub"
                  />
                  <p className="text-xs text-muted-foreground">
                    Shown in the sidebar header and on your online ordering page
                  </p>
                </div>

                <Button onClick={handleSaveBranding} disabled={savingBranding}>
                  {savingBranding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Identity
                </Button>
              </CardContent>
            </Card>

            {/* Brand Color for Online Ordering */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Online Ordering App Color
                </CardTitle>
                <CardDescription>
                  This color is used as the accent/primary color in your customer-facing ordering page
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="h-12 w-12 rounded-lg cursor-pointer border border-border"
                  />
                  <div>
                    <p className="text-sm font-medium">{brandColor.toUpperCase()}</p>
                    <p className="text-xs text-muted-foreground">Click to pick a color</p>
                  </div>
                  <div
                    className="flex-1 h-10 rounded-lg border border-border flex items-center justify-center text-white text-sm font-medium"
                    style={{ backgroundColor: brandColor }}
                  >
                    Preview Button
                  </div>
                </div>
                <Button onClick={handleSaveBranding} disabled={savingBranding}>
                  {savingBranding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Color
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Customer UPI payments (default)</CardTitle>
                <CardDescription>
                  Used for all outlets unless overridden on an outlet. Razorpay remains for subscriptions only.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable UPI for online orders</Label>
                  <Switch checked={onlinePaymentsEnabled} onCheckedChange={setOnlinePaymentsEnabled} />
                </div>
                <div className="space-y-2">
                  <Label>UPI ID (VPA)</Label>
                  <Input
                    placeholder="yourname@paytm"
                    value={upiVpa}
                    onChange={(e) => setUpiVpa(e.target.value)}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Display name on UPI apps</Label>
                  <Input
                    value={upiDisplayName}
                    onChange={(e) => setUpiDisplayName(e.target.value)}
                    placeholder={brandName || "Your restaurant"}
                  />
                </div>
                <UpiQrUpload value={upiQrUrl} onChange={setUpiQrUrl} />
                <Button onClick={handleSaveBranding} disabled={savingBranding}>
                  {savingBranding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save UPI settings
                </Button>
              </CardContent>
            </Card>

            {/* App Theme */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                  Dashboard Theme
                </CardTitle>
                <CardDescription>
                  Switch between light and dark mode for your admin dashboard
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleThemeChange("light")}
                    className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${
                      theme === "light" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"
                    }`}
                  >
                    <Sun className={`h-6 w-6 ${theme === "light" ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`text-sm font-medium ${theme === "light" ? "text-primary" : "text-muted-foreground"}`}>
                      Light
                    </span>
                  </button>
                  <button
                    onClick={() => handleThemeChange("dark")}
                    className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${
                      theme === "dark" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"
                    }`}
                  >
                    <Moon className={`h-6 w-6 ${theme === "dark" ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`text-sm font-medium ${theme === "dark" ? "text-primary" : "text-muted-foreground"}`}>
                      Dark
                    </span>
                  </button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subscription Tab (web only — native app opens browser) */}
          {!isNativeAppBilling && (
          <TabsContent value="subscription" className="space-y-6">

            {/* Current Plan Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-primary" />
                  Current Plan
                </CardTitle>
                <CardDescription className="flex flex-wrap items-center justify-between gap-2">
                  <span>Your active subscription details</span>
                  <Link to="/addons" className="text-primary text-sm font-medium hover:underline">
                    Manage add-ons →
                  </Link>
                </CardDescription>
              </CardHeader>
              <CardContent>
                {subLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : subscription ? (
                  <div className="space-y-5">
                    <div className="flex items-center gap-3">
                      <h3 className="text-2xl font-bold capitalize">{getPlanDisplay()}</h3>
                      {getStatusBadge()}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 text-sm">
                      {subscription.current_period_start && (
                        <div className="space-y-0.5">
                          <p className="text-muted-foreground">Started</p>
                          <p className="font-medium flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            {format(new Date(subscription.current_period_start), "MMM d, yyyy")}
                          </p>
                        </div>
                      )}
                      {expiresAt && (
                        <div className="space-y-0.5">
                          <p className="text-muted-foreground">Expires</p>
                          <p className="font-medium flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            {format(expiresAt, "MMM d, yyyy")}
                          </p>
                        </div>
                      )}
                      {subscription.period_months && (
                        <div className="space-y-0.5">
                          <p className="text-muted-foreground">Duration</p>
                          <p className="font-medium">{subscription.period_months} month{subscription.period_months > 1 ? "s" : ""}</p>
                        </div>
                      )}
                      {hasActiveSubscription && daysUntilExpiry >= 0 && (
                        <div className="space-y-0.5">
                          <p className="text-muted-foreground">Days Remaining</p>
                          <p className={`font-medium ${daysUntilExpiry <= 7 ? "text-destructive" : "text-green-600"}`}>
                            {daysUntilExpiry === 0 ? "Expires today" : `${daysUntilExpiry} days`}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Cancel option */}
                    {hasActiveSubscription && (
                      <>
                        <Separator />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                              Cancel Subscription
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Your plan will remain active until {expiresAt ? format(expiresAt, "MMM d, yyyy") : "expiry"}. After that you'll lose access to the dashboard. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive hover:bg-destructive/90"
                                onClick={handleCancel}
                                disabled={cancelling}
                              >
                                {cancelling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Yes, Cancel
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-2">No active subscription. Choose a plan below to get started.</p>
                )}
              </CardContent>
            </Card>

            {/* Plans + Purchase */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  {hasActiveSubscription ? "Renew or Change Plan" : "Choose a Plan"}
                </CardTitle>
                <CardDescription>
                  {isNativeAppBilling
                    ? "Subscription payment opens in your browser (Play Store policy). Return to the app after paying."
                    : hasActiveSubscription
                      ? "Renew your current plan or switch to a different one. Payment extends from today."
                      : "Select a plan and duration to activate your subscription via Razorpay."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Duration selector */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Select Duration</p>
                  <div className="flex gap-2 flex-wrap">
                    {BILLING_PERIOD_MONTHS.map((m) => {
                      const disc = DISCOUNTS[m];
                      return (
                        <button
                          key={m}
                          onClick={() => setPlanMonths(m)}
                          className={`relative px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                            planMonths === m
                              ? "bg-primary text-primary-foreground border-primary shadow-md"
                              : "bg-background border-border hover:border-primary/50"
                          }`}
                        >
                          {billingPeriodLabel(m)}
                          {disc > 0 && (
                            <span className={`ml-1.5 text-[10px] font-bold ${planMonths === m ? "text-primary-foreground/80" : "text-green-600"}`}>
                              -{disc * 100}%
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Plan cards */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {/* Starter */}
                  {(() => {
                    const total = calcPlanTotal("starter", planMonths);
                    const savings = calcPlanSavings("starter", planMonths);
                    const isCurrentPlan = subscription?.plan_type === "starter" && hasActiveSubscription;
                    return (
                      <div className={`flex flex-col rounded-xl border p-5 gap-4 ${isCurrentPlan ? "border-primary ring-1 ring-primary" : "border-border"}`}>
                        {isCurrentPlan && <span className="text-xs font-semibold text-primary">Current Plan</span>}
                        <div>
                          <h3 className="text-lg font-bold">Launcher</h3>
                          <p className="text-sm text-muted-foreground">Everything you need to run one outlet.</p>
                        </div>
                        <div>
                          <span className="text-2xl font-bold">₹{total.toLocaleString("en-IN")}</span>
                          <span className="text-muted-foreground text-sm"> / {planMonths} months</span>
                          {savings > 0 && <p className="text-xs text-green-600 font-medium mt-0.5">Save ₹{savings.toLocaleString("en-IN")}</p>}
                        </div>
                        <ul className="space-y-1.5 flex-1 text-sm">
                          {["1 Outlet", "1 staff account", "Order, menu, kitchen & table management", "Analytics & reports", "Email support"].map((f) => (
                            <li key={f} className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />{f}</li>
                          ))}
                        </ul>
                        <Button
                          variant="outline"
                          className="w-full"
                          disabled={!!payingPlan}
                          onClick={() => handlePay("starter")}
                        >
                          {payingPlan === "starter" ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Opening…</>
                          ) : isNativeAppBilling ? (
                            `Continue in browser · ₹${total.toLocaleString("en-IN")}`
                          ) : (
                            `Pay ₹${total.toLocaleString("en-IN")}`
                          )}
                        </Button>
                      </div>
                    );
                  })()}

                  {/* Professional */}
                  {(() => {
                    const total = calcPlanTotal("professional", planMonths);
                    const savings = calcPlanSavings("professional", planMonths);
                    const isCurrentPlan = subscription?.plan_type === "professional" && hasActiveSubscription;
                    return (
                      <div className={`flex flex-col rounded-xl border-2 p-5 gap-4 relative ${isCurrentPlan ? "border-primary" : "border-primary"}`}>
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                            {isCurrentPlan ? "Current Plan" : "Most Popular"}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-lg font-bold">Growth</h3>
                          <p className="text-sm text-muted-foreground">Launcher plus mobile app and priority support.</p>
                        </div>
                        <div>
                          <span className="text-2xl font-bold">₹{total.toLocaleString("en-IN")}</span>
                          <span className="text-muted-foreground text-sm"> / {planMonths} months</span>
                          {savings > 0 && <p className="text-xs text-green-600 font-medium mt-0.5">Save ₹{savings.toLocaleString("en-IN")}</p>}
                        </div>
                        <ul className="space-y-1.5 flex-1 text-sm">
                          {["1 Outlet", "2 staff accounts", "All Launcher features", "Mobile app access", "Priority support"].map((f) => (
                            <li key={f} className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />{f}</li>
                          ))}
                        </ul>
                        <Button
                          className="w-full gradient-primary glow-primary"
                          disabled={!!payingPlan}
                          onClick={() => handlePay("professional")}
                        >
                          {payingPlan === "professional" ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Opening…</>
                          ) : isNativeAppBilling ? (
                            `Continue in browser · ₹${total.toLocaleString("en-IN")}`
                          ) : (
                            `Pay ₹${total.toLocaleString("en-IN")}`
                          )}
                        </Button>
                      </div>
                    );
                  })()}

                  {/* Enterprise */}
                  <div className="flex flex-col rounded-xl border border-border p-5 gap-4">
                    <div>
                      <h3 className="text-lg font-bold">Expand</h3>
                      <p className="text-sm text-muted-foreground">For multi-branch brands with custom needs.</p>
                    </div>
                    <div><span className="text-2xl font-bold">Custom</span></div>
                    <ul className="space-y-1.5 flex-1 text-sm">
                      {["Unlimited outlets", "Flexible staff scaling", "All Growth features", "Custom integrations", "Multi-branch management", "Dedicated support"].map((f) => (
                        <li key={f} className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />{f}</li>
                      ))}
                    </ul>
                    <Button variant="outline" className="w-full" onClick={() => window.open("mailto:connect@banaoo.in?subject=Expand Plan Enquiry", "_blank")}>
                      Contact Us
                    </Button>
                  </div>
                </div>

                <p className="text-center text-xs text-muted-foreground">🔒 Secure payment via Razorpay · UPI · Cards · Net Banking</p>
              </CardContent>
            </Card>
          </TabsContent>
          )}

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="h-5 w-5" />
                      All Notifications
                    </CardTitle>
                    <CardDescription>
                      View and manage your notifications
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {unreadCount > 0 && (
                      <Button variant="outline" size="sm" onClick={markAllAsRead}>
                        Mark all read
                      </Button>
                    )}
                    {notifications.length > 0 && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                            Clear all
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Clear all notifications?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete all your notifications. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={clearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Clear All
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {notifLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="text-center py-8 space-y-4">
                    <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <Bell className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-semibold">No Notifications</h3>
                      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                        You're all caught up! We'll notify you about important updates here.
                      </p>
                    </div>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px] -mx-6 px-6">
                    <div className="space-y-3">
                      {notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`p-4 rounded-lg border transition-colors ${
                            notification.read ? "bg-background" : "bg-primary/5 border-primary/20"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={`font-medium ${!notification.read ? "text-primary" : ""}`}>
                                  {notification.title}
                                </p>
                                {!notification.read && (
                                  <span className="w-2 h-2 bg-primary rounded-full shrink-0" />
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {notification.message}
                              </p>
                              <p className="text-xs text-muted-foreground mt-2">
                                {format(new Date(notification.created_at), "MMM d, yyyy 'at' h:mm a")}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              {!notification.read && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => markAsRead(notification.id)}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => deleteNotification(notification.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Preferences
                </CardTitle>
                <CardDescription>
                  Configure how you receive notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="order-notifications">Order Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when new orders are placed
                    </p>
                  </div>
                  <Switch id="order-notifications" defaultChecked />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="subscription-notifications">Subscription Reminders</Label>
                    <p className="text-sm text-muted-foreground">
                      Reminders about trial ending and payment due dates
                    </p>
                  </div>
                  <Switch id="subscription-notifications" defaultChecked />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="kitchen-alerts">Kitchen Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Audio alerts for kitchen display updates
                    </p>
                  </div>
                  <Switch id="kitchen-alerts" defaultChecked />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="email-updates">Email Updates</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive weekly summary and tips via email
                    </p>
                  </div>
                  <Switch id="email-updates" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="preferences" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security
                </CardTitle>
                <CardDescription>
                  Manage your account security settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Password</Label>
                    <p className="text-sm text-muted-foreground">
                      Change your account password
                    </p>
                  </div>
                  <Button variant="outline">Change Password</Button>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Two-Factor Authentication</Label>
                    <p className="text-sm text-muted-foreground">
                      Add an extra layer of security to your account
                    </p>
                  </div>
                  <Badge variant="secondary">Coming Soon</Badge>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Active Sessions</Label>
                    <p className="text-sm text-muted-foreground">
                      Manage devices where you're logged in
                    </p>
                  </div>
                  <Badge variant="secondary">Coming Soon</Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Printers Tab */}
          <TabsContent value="printers" className="space-y-6">
            <PrinterFleetSettings />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { useSubscription } from "@/hooks/use-subscription";
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
  Link2,
  Copy,
  ExternalLink,
  Palette,
  Upload,
  Sun,
  Moon,
  ImageIcon,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  } = useSubscription();
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

  // Subscription / plan state
  const [planMonths, setPlanMonths] = useState(1);
  const [payingPlan, setPayingPlan] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const BASE_PRICES: Record<string, number> = { starter: 999, professional: 2499 };
  const DISCOUNTS: Record<number, number> = { 1: 0, 3: 0.05, 6: 0.10, 12: 0.20 };
  const calcTotal = (plan: string, months: number) =>
    Math.round((BASE_PRICES[plan] ?? 0) * months * (1 - (DISCOUNTS[months] ?? 0)));
  const calcSavings = (plan: string, months: number) =>
    Math.round(BASE_PRICES[plan] * months) - calcTotal(plan, months);

  const handlePay = async (planId: "starter" | "professional") => {
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

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
      setBusinessType(profile.business_type || "");
      setBrandName(profile.brand_name || "");
      setBrandColor(profile.brand_color || "#f97316");
      setLogoPreview(profile.logo_url || null);
    }
  }, [profile]);

  const handleUpdateProfile = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, phone, business_type: businessType || null })
        .eq("user_id", user.id);

      if (error) throw error;
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
      
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ logo_url: data.url })
        .eq("user_id", user.id);
        
      if (updateError) throw updateError;

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
      const { error } = await supabase
        .from("profiles")
        .update({ brand_name: brandName || null, brand_color: brandColor })
        .eq("user_id", user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success("Branding saved!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save branding");
    } finally {
      setSavingBranding(false);
    }
  };

  const handleThemeChange = async (newTheme: "light" | "dark") => {
    setTheme(newTheme);
    if (user) {
      await supabase.from("profiles").update({ app_theme: newTheme }).eq("user_id", user.id);
    }
  };

  const getPlanDisplay = () => {
    if (!subscription) return "No Plan";
    return subscription.plan_type.charAt(0).toUpperCase() + subscription.plan_type.slice(1);
  };

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

        <Tabs defaultValue={searchParams.get("tab") || "profile"} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="branding" className="gap-2">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Branding</span>
            </TabsTrigger>
            <TabsTrigger value="subscription" className="gap-2">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Subscription</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2 relative">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notifications</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="preferences" className="gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Security</span>
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

            {/* Online Ordering Link */}
            {profile?.ordering_slug && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Link2 className="h-5 w-5" />
                    Online Ordering Link
                  </CardTitle>
                  <CardDescription>
                    Share this link with your customers. It shows all your outlets with GPS-based distance sorting.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                    <span className="text-sm font-mono text-primary truncate flex-1">
                      {window.location.origin}/order/{profile.ordering_slug}
                    </span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0"
                      onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/order/${profile.ordering_slug}`); toast.success("Link copied!"); }}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0"
                      onClick={() => window.open(`/order/${profile.ordering_slug}`, "_blank")}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    To update outlet locations for GPS sorting, go to <strong>Outlets → Edit</strong> and pin the location on the map.
                  </p>
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
                            await supabase.from("profiles").update({ logo_url: null }).eq("user_id", user!.id);
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

          {/* Subscription Tab */}
          <TabsContent value="subscription" className="space-y-6">

            {/* Current Plan Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-primary" />
                  Current Plan
                </CardTitle>
                <CardDescription>Your active subscription details</CardDescription>
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
                  {hasActiveSubscription
                    ? "Renew your current plan or switch to a different one. Payment extends from today."
                    : "Select a plan and duration to activate your subscription via Razorpay."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Duration selector */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Select Duration</p>
                  <div className="flex gap-2 flex-wrap">
                    {([1, 3, 6, 12] as const).map((m) => {
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
                          {m === 1 ? "1 Month" : m === 3 ? "3 Months" : m === 6 ? "6 Months" : "12 Months"}
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
                    const total = calcTotal("starter", planMonths);
                    const savings = calcSavings("starter", planMonths);
                    const isCurrentPlan = subscription?.plan_type === "starter" && hasActiveSubscription;
                    return (
                      <div className={`flex flex-col rounded-xl border p-5 gap-4 ${isCurrentPlan ? "border-primary ring-1 ring-primary" : "border-border"}`}>
                        {isCurrentPlan && <span className="text-xs font-semibold text-primary">Current Plan</span>}
                        <div>
                          <h3 className="text-lg font-bold">Starter</h3>
                          <p className="text-sm text-muted-foreground">Perfect for small restaurants just getting started.</p>
                        </div>
                        <div>
                          <span className="text-2xl font-bold">₹{total.toLocaleString("en-IN")}</span>
                          <span className="text-muted-foreground text-sm"> / {planMonths === 1 ? "month" : `${planMonths} months`}</span>
                          {savings > 0 && <p className="text-xs text-green-600 font-medium mt-0.5">Save ₹{savings.toLocaleString("en-IN")}</p>}
                        </div>
                        <ul className="space-y-1.5 flex-1 text-sm">
                          {["1 Outlet", "Up to 5 staff accounts", "Basic order management", "Menu management", "Email support", "Mobile app access"].map((f) => (
                            <li key={f} className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />{f}</li>
                          ))}
                        </ul>
                        <Button
                          variant="outline"
                          className="w-full"
                          disabled={!!payingPlan}
                          onClick={() => handlePay("starter")}
                        >
                          {payingPlan === "starter" ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Opening…</> : `Pay ₹${total.toLocaleString("en-IN")}`}
                        </Button>
                      </div>
                    );
                  })()}

                  {/* Professional */}
                  {(() => {
                    const total = calcTotal("professional", planMonths);
                    const savings = calcSavings("professional", planMonths);
                    const isCurrentPlan = subscription?.plan_type === "professional" && hasActiveSubscription;
                    return (
                      <div className={`flex flex-col rounded-xl border-2 p-5 gap-4 relative ${isCurrentPlan ? "border-primary" : "border-primary"}`}>
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                            {isCurrentPlan ? "Current Plan" : "Most Popular"}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-lg font-bold">Professional</h3>
                          <p className="text-sm text-muted-foreground">Best for growing restaurants with multiple needs.</p>
                        </div>
                        <div>
                          <span className="text-2xl font-bold">₹{total.toLocaleString("en-IN")}</span>
                          <span className="text-muted-foreground text-sm"> / {planMonths === 1 ? "month" : `${planMonths} months`}</span>
                          {savings > 0 && <p className="text-xs text-green-600 font-medium mt-0.5">Save ₹{savings.toLocaleString("en-IN")}</p>}
                        </div>
                        <ul className="space-y-1.5 flex-1 text-sm">
                          {["Up to 3 Outlets", "Unlimited staff accounts", "Advanced order management", "Kitchen display system", "AI menu import", "Analytics & reports", "Priority support", "Table management"].map((f) => (
                            <li key={f} className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />{f}</li>
                          ))}
                        </ul>
                        <Button
                          className="w-full gradient-primary glow-primary"
                          disabled={!!payingPlan}
                          onClick={() => handlePay("professional")}
                        >
                          {payingPlan === "professional" ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Opening…</> : `Pay ₹${total.toLocaleString("en-IN")}`}
                        </Button>
                      </div>
                    );
                  })()}

                  {/* Enterprise */}
                  <div className="flex flex-col rounded-xl border border-border p-5 gap-4">
                    <div>
                      <h3 className="text-lg font-bold">Enterprise</h3>
                      <p className="text-sm text-muted-foreground">For large chains with custom requirements.</p>
                    </div>
                    <div><span className="text-2xl font-bold">Custom</span></div>
                    <ul className="space-y-1.5 flex-1 text-sm">
                      {["Unlimited Outlets", "Unlimited staff accounts", "All Professional features", "Custom integrations", "Dedicated account manager", "24/7 phone support"].map((f) => (
                        <li key={f} className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />{f}</li>
                      ))}
                    </ul>
                    <Button variant="outline" className="w-full" onClick={() => window.open("mailto:connect@banaoo.in?subject=Enterprise Plan Enquiry", "_blank")}>
                      Contact Sales
                    </Button>
                  </div>
                </div>

                <p className="text-center text-xs text-muted-foreground">🔒 Secure payment via Razorpay · UPI · Cards · Net Banking</p>
              </CardContent>
            </Card>
          </TabsContent>

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
        </Tabs>
      </div>
    </AppLayout>
  );
}

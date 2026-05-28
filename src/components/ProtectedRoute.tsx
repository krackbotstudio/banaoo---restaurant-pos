import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useStaffPermissions } from "@/lib/use-staff-permissions";
import { Loader2 } from "lucide-react";

// Routes that don't require onboarding to be done
const ONBOARDING_EXEMPT_ROUTES = [
  "/onboarding",
  "/settings",
  "/account-pending",
  "/admin/accounts",
  "/billing/checkout",
];

/** Maps a URL pathname to the permission key needed to access it (staff only). */
function getRoutePermissionKey(pathname: string): string | null {
  if (pathname === "/dashboard") return "dashboard";
  if (pathname.startsWith("/outlets")) return "outlets";
  if (pathname.startsWith("/menu")) return "menu";
  if (pathname.startsWith("/orders")) return "orders";
  if (pathname === "/kitchen") return "kitchen";
  if (pathname === "/payments") return "payments";
  if (pathname === "/analytics") return "analytics";
  if (pathname === "/customers") return "customers";
  if (pathname === "/inventory") return "inventory";
  if (pathname === "/order-history") return "order-history";
  if (pathname === "/staff") return "staff";
  if (pathname === "/integrations") return "integrations";
  if (pathname.startsWith("/settings")) return "settings";
  return null; // untracked routes pass through
}

const ROUTE_MAP: Record<string, string> = {
  dashboard: "/dashboard",
  outlets: "/outlets",
  menu: "/menu",
  orders: "/orders",
  kitchen: "/kitchen",
  payments: "/payments",
  analytics: "/analytics",
  customers: "/customers",
  inventory: "/inventory",
  "order-history": "/order-history",
  staff: "/staff",
  integrations: "/integrations",
  settings: "/settings",
};

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading: authLoading, profileLoading, signOut } = useAuth();
  const { permissions, loading: permissionsLoading } = useStaffPermissions();
  const navigate = useNavigate();
  const location = useLocation();

  const isOnboardingExempt = ONBOARDING_EXEMPT_ROUTES.includes(location.pathname);

  useEffect(() => {
    if (authLoading || profileLoading) return;

    // Not authenticated → landing page
    if (!user) {
      navigate("/");
      return;
    }

    // Profile failed to load after all retries — sign out and restart
    if (!profile) {
      signOut().then(() => navigate("/auth"));
      return;
    }

    // Staff accounts: enforce page-level permissions
    if (profile.role !== "owner") {
      if (permissionsLoading) return; // wait for permissions before checking
      if (permissions) {
        const routeKey = getRoutePermissionKey(location.pathname);
        if (routeKey && !permissions.includes(routeKey)) {
          // Redirect to first allowed page
          const firstAllowed = permissions[0];
          navigate(ROUTE_MAP[firstAllowed] ?? "/dashboard", { replace: true });
        }
      }
      return;
    }

    // Admin users can access everything
    if (profile.is_admin) return;

    // Rejected accounts can only see the account-pending page
    if (profile.account_status === "rejected" && location.pathname !== "/account-pending") {
      navigate("/account-pending");
      return;
    }

    // Pending accounts wait for admin approval (except browser billing checkout)
    if (
      profile.account_status === "pending" &&
      location.pathname !== "/account-pending" &&
      !location.pathname.startsWith("/billing/checkout")
    ) {
      navigate("/account-pending");
      return;
    }

    // Onboarding not done → restaurant setup
    if (!profile.onboarding_completed && !isOnboardingExempt) {
      navigate("/onboarding");
    }
  }, [
    user, profile, authLoading, profileLoading,
    permissions, permissionsLoading,
    navigate, signOut, isOnboardingExempt, location.pathname
  ]);

  // Auth loading
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const redirectLoader = (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (!user) return redirectLoader;

  // Profile still loading
  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Profile failed to load — useEffect will sign out
  if (!profile) return redirectLoader;

  // Admins: render immediately
  if (profile.is_admin) return <>{children}</>;

  // Staff: wait for permissions to avoid unauthorized page flash.
  if (profile.role !== "owner") {
    if (permissionsLoading || permissions === undefined) return redirectLoader;
    const routeKey = getRoutePermissionKey(location.pathname);
    if (routeKey && Array.isArray(permissions) && !permissions.includes(routeKey)) {
      return redirectLoader;
    }
    return <>{children}</>;
  }

  // Block: onboarding not done
  if (!isOnboardingExempt && !profile.onboarding_completed) return redirectLoader;

  return <>{children}</>;
}

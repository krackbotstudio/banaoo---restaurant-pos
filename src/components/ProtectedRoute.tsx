import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";

// Routes that don't require onboarding to be done
const ONBOARDING_EXEMPT_ROUTES = ["/onboarding", "/settings", "/account-pending", "/admin/accounts"];

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading: authLoading, profileLoading, signOut } = useAuth();
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

    // Staff accounts bypass all checks
    if (profile.role !== "owner") return;

    // Admin users can access everything
    if (profile.is_admin) return;

    // Rejected accounts can only see the account-pending page
    if (profile.account_status === "rejected" && location.pathname !== "/account-pending") {
      navigate("/account-pending");
      return;
    }

    // Pending accounts wait for admin approval
    if (profile.account_status === "pending" && location.pathname !== "/account-pending") {
      navigate("/account-pending");
      return;
    }

    // Onboarding not done → restaurant setup
    if (!profile.onboarding_completed && !isOnboardingExempt) {
      navigate("/onboarding");
    }
  }, [
    user, profile, authLoading, profileLoading,
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

  if (!user) return null;

  // Profile still loading
  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Profile failed to load — useEffect will sign out
  if (!profile) return null;

  // Staff and admins: render immediately
  if (profile.role !== "owner" || profile.is_admin) return <>{children}</>;

  // Block: onboarding not done
  if (!isOnboardingExempt && !profile.onboarding_completed) return null;

  return <>{children}</>;
}

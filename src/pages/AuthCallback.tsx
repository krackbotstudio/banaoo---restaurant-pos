/**
 * Silent OAuth callback handler.
 * Google (and other OAuth providers) redirect here after authentication.
 * Shows a spinner while we determine where to send the user.
 *
 * Routing logic:
 *   pending/rejected →  /account-pending
 *   no onboarding    →  /onboarding
 *   everything OK    →  /dashboard
 */
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AuthCallback() {
  const { user, profile, loading: authLoading, profileLoading } = useAuth();
  const navigate = useNavigate();
  const redirected = useRef(false);

  useEffect(() => {
    if (authLoading || profileLoading) return;
    if (redirected.current) return;

    if (!user) return;

    if (!profile) {
      redirected.current = true;
      navigate("/auth", { replace: true });
      return;
    }

    redirected.current = true;

    // Staff → dashboard directly
    if (profile.role !== "owner") {
      navigate("/dashboard", { replace: true });
      return;
    }

    // Admin → dashboard
    if (profile.is_admin) {
      navigate("/dashboard", { replace: true });
      return;
    }

    // Rejected or pending → account-pending page
    if (profile.account_status === "rejected" || profile.account_status === "pending") {
      navigate("/account-pending", { replace: true });
      return;
    }

    // Onboarding not done → restaurant setup
    if (!profile.onboarding_completed) {
      navigate("/onboarding", { replace: true });
      return;
    }

    // Everything OK — existing user returning
    toast.success(`Welcome back, ${profile.full_name?.split(" ")[0] || "there"}! 👋`);
    navigate("/dashboard", { replace: true });
  }, [user, profile, authLoading, profileLoading, navigate]);

  // Fallback: if no user after 8 seconds, redirect to auth
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!redirected.current) {
        navigate("/auth", { replace: true });
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <div className="flex items-center justify-center h-14 w-14 rounded-2xl gradient-warm glow-primary">
        <img src="/logo.png" alt="Banaoo" className="h-7 w-7 object-contain brightness-0 invert" />
      </div>
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </div>
  );
}

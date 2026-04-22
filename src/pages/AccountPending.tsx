import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle2, XCircle, Mail, LogOut, Loader2 } from "lucide-react";

export default function AccountPending() {
  const { user, profile, loading, profileLoading, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) navigate("/");
  }, [user, loading, navigate]);

  // Redirect once admin approves: go to onboarding first if not done, then dashboard
  useEffect(() => {
    if (profile?.account_status === "approved") {
      const dest = !profile.onboarding_completed ? "/onboarding" : "/dashboard";
      navigate(dest);
    }
  }, [profile, navigate]);

  // Poll every 15 seconds to check approval status
  useEffect(() => {
    const interval = setInterval(() => {
      refreshProfile();
    }, 15000);
    return () => clearInterval(interval);
  }, [refreshProfile]);

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isRejected = profile?.account_status === "rejected";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-primary/5 to-background px-4">
      {/* Logo */}
      <div className="flex items-center justify-center h-16 w-16 rounded-2xl gradient-warm glow-primary mb-6">
        <img src="/logo.png" alt="Banaoo" className="h-8 w-8 object-contain brightness-0 invert" />
      </div>

      <h1 className="font-display text-3xl font-bold tracking-tight mb-1">banaoo.io</h1>

      <div className="mt-10 max-w-md w-full text-center space-y-6">
        {isRejected ? (
          <>
            <div className="mx-auto w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-10 w-10 text-destructive" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Application Needs Review</h2>
              <p className="text-muted-foreground leading-relaxed">
                Your account application requires further information. Our team will reach out to you shortly to help get you set up.
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-xl border text-sm text-muted-foreground">
              <Mail className="h-4 w-4 inline mr-2" />
              Questions? Email us at{" "}
              <a href="mailto:connect@banaoo.in" className="text-primary underline font-medium">
                connect@banaoo.in
              </a>
            </div>
          </>
        ) : (
          <>
            <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Clock className="h-10 w-10 text-primary animate-pulse" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Account Under Review</h2>
              <p className="text-muted-foreground leading-relaxed">
                Hi <span className="font-medium text-foreground">{profile?.full_name || "there"}</span>! Your account has been submitted and is being reviewed by our team.
              </p>
              <p className="text-muted-foreground text-sm">
                We verify each restaurant owner to ensure a trusted experience. You'll be notified as soon as your account is approved.
              </p>
            </div>

            {/* Steps */}
            <div className="text-left space-y-3 p-4 bg-muted/30 rounded-xl border">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Account created</p>
                  <p className="text-xs text-muted-foreground">Your account has been registered</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center flex-shrink-0">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Under review</p>
                  <p className="text-xs text-muted-foreground">Our team is verifying your details</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-muted border-2 border-border flex items-center justify-center flex-shrink-0">
                  <span className="text-xs text-muted-foreground font-bold">3</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Get started</p>
                  <p className="text-xs text-muted-foreground">Access your dashboard once approved</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              This page automatically checks for updates every 15 seconds.
            </p>

            <div className="text-sm text-muted-foreground">
              <Mail className="h-4 w-4 inline mr-1.5" />
              Questions?{" "}
              <a href="mailto:connect@banaoo.in" className="text-primary underline">
                connect@banaoo.in
              </a>
            </div>
          </>
        )}

        <Button
          variant="ghost"
          className="w-full text-muted-foreground"
          onClick={async () => { await signOut(); navigate("/"); }}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign out
        </Button>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { getRestaurantPostAuthPath } from "@/lib/post-auth-redirect";
import { API_URL } from "@/lib/api-url";
import { CURRENT_TERMS_VERSION } from "@/lib/legal";
import { SEO } from "@/components/seo/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  ArrowLeft,
  Mail,
  Lock,
  User,
  Phone,
  Eye,
  EyeOff,
  Receipt,
  Smartphone,
  ChefHat,
  Bike,
  Sparkles,
} from "lucide-react";

const emailSchema = z.string().email("Please enter a valid email");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");
const phoneSchema = z
  .string()
  .min(10, "Phone number must be at least 10 digits")
  .regex(/^[+]?[0-9\s\-]{10,}$/, "Please enter a valid phone number");

type AuthMode = "login" | "signup";
type AuthView = "main" | "forgot-password";

export default function Auth() {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [view, setView] = useState<AuthView>("main");
  const [mode, setMode] = useState<AuthMode>("login");

  useEffect(() => {
    const clearOrphanedSession = async () => {
      try {
        const res = await fetch(`${API_URL}/auth/me`, { credentials: "include" });
        if (res.status === 401) {
          await fetch(`${API_URL}/auth/clear-session`, {
            method: "POST",
            credentials: "include",
          });
        }
      } catch (err) {
        console.error("Error checking/clearing session:", err);
      }
    };
    clearOrphanedSession();
  }, []);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupAcceptedTerms, setSignupAcceptedTerms] = useState(false);

  const [resetEmail, setResetEmail] = useState("");
  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(null);

  const { signIn, signUp, resetPassword } = useAuth();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/providers`);
        if (!res.ok) throw new Error("providers unavailable");
        const data = (await res.json()) as { google?: boolean };
        if (!cancelled) setGoogleEnabled(!!data.google);
      } catch {
        if (!cancelled) setGoogleEnabled(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (searchParams.get("google_unavailable") === "1") {
      toast({
        variant: "destructive",
        title: "Google sign-in unavailable",
        description:
          "Google OAuth is not configured on the API server. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env, then restart npm run server.",
      });
    } else if (searchParams.get("google_error") === "1") {
      toast({
        variant: "destructive",
        title: "Google sign-in failed",
        description: "Please try again or use email and password.",
      });
    }
  }, [searchParams, toast]);

  const handleGoogleSignIn = async (isSignupContext = false) => {
    if (googleEnabled === false) {
      toast({
        variant: "destructive",
        title: "Google sign-in unavailable",
        description:
          "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your .env file and restart the API server.",
      });
      return;
    }
    if (isSignupContext && !signupAcceptedTerms) {
      toast({
        variant: "destructive",
        title: "Please accept the Terms & Policies",
        description: "Tick the box below to continue with Google sign up.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSignupContext) {
        try {
          const prep = await fetch(`${API_URL}/auth/google/prepare`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ terms_version: CURRENT_TERMS_VERSION }),
          });
          if (!prep.ok) {
            const data = await prep.json().catch(() => ({}));
            throw new Error(data.error || "Could not record Terms acceptance");
          }
        } catch (err) {
          setIsSubmitting(false);
          toast({
            variant: "destructive",
            title: "Google Sign-Up Failed",
            description: err instanceof Error ? err.message : "Unknown error",
          });
          return;
        }
      }

      const callbackUrl = `${window.location.origin}/auth/callback`;
      const googleUrl = `${API_URL}/auth/google?redirect_uri=${encodeURIComponent(callbackUrl)}`;
      window.location.href = googleUrl;
    } catch (error) {
      console.error("Google sign-in error:", error);
      setIsSubmitting(false);
      toast({
        variant: "destructive",
        title: "Google Sign-In Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  useEffect(() => {
    const refCode = searchParams.get("ref");
    if (refCode) {
      localStorage.setItem("banaoo_referral_code", refCode);
    }
    const mParam = searchParams.get("mode");
    if (mParam === "signup" || mParam === "login") {
      setMode(mParam);
    }
  }, [searchParams]);

  useEffect(() => {
    const shouldSwitch = searchParams.get("switch") === "1";
    if (!shouldSwitch || loading) return;
    if (!user) return;
    void signOut();
  }, [searchParams, loading, user, signOut]);

  useEffect(() => {
    const shouldSwitch = searchParams.get("switch") === "1";
    if (!loading && user && profile && !shouldSwitch) {
      navigate(getRestaurantPostAuthPath(profile), { replace: true });
    }
  }, [user, loading, profile, navigate, searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      emailSchema.parse(loginEmail);
      passwordSchema.parse(loginPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: err.errors[0].message,
        });
        return;
      }
    }

    setIsSubmitting(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setIsSubmitting(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error.message,
      });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!signupName.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please enter your name",
      });
      return;
    }

    if (!signupAcceptedTerms) {
      toast({
        variant: "destructive",
        title: "Please accept the Terms & Policies",
        description: "Tick the box at the bottom of the form to continue.",
      });
      return;
    }

    try {
      emailSchema.parse(signupEmail);
      phoneSchema.parse(signupPhone);
      passwordSchema.parse(signupPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: err.errors[0].message,
        });
        return;
      }
    }

    setIsSubmitting(true);
    const { error } = await signUp(signupEmail, signupPassword, signupName, signupPhone, {
      terms_version: CURRENT_TERMS_VERSION,
    });
    setIsSubmitting(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Signup Failed",
        description: error.message,
      });
    } else {
      toast({
        title: "Account Created!",
        description: "Welcome! Please choose a plan to get started.",
      });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      emailSchema.parse(resetEmail);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: err.errors[0].message,
        });
        return;
      }
    }

    setIsSubmitting(true);
    const { error } = await resetPassword(resetEmail);
    setIsSubmitting(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Feature Not Available",
        description:
          "Password reset via email is not yet implemented in the custom backend. Please contact support.",
      });
    } else {
      toast({
        title: "Success",
        description: "Password reset request processed.",
      });
      setView("main");
      setResetEmail("");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const GoogleIcon = () => (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <SEO
        title={mode === "signup" ? "Create your account" : "Sign in"}
        description="Sign in to your banaoo restaurant account or create a new one to start managing your restaurant in minutes."
        path="/auth"
        noindex
      />
      {/* LEFT: Form column */}
      <div className="flex flex-col px-6 py-8 sm:px-10 lg:px-14 xl:px-20">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-4">
          <Link to="/" className="inline-flex items-center gap-2 group">
            <span className="flex items-center justify-center h-9 w-9 rounded-xl gradient-warm shadow-warm">
              <img
                src="/logo.png"
                alt=""
                className="h-5 w-5 object-contain brightness-0 invert"
              />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">
              banaoo
            </span>
          </Link>

          <Link
            to="/"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </header>

        {/* Centered form area */}
        <div className="flex-1 flex items-center justify-center py-10">
          <div className="w-full max-w-sm">
            {view === "main" ? (
              <>
                {/* Heading */}
                <div className="space-y-1.5 mb-8">
                  <h1 className="font-display text-3xl sm:text-[2rem] font-bold tracking-tight leading-tight">
                    {mode === "login" ? "Sign In" : "Create your account"}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {mode === "login"
                      ? "Welcome back. Let's get you to your kitchen."
                      : "Start running your restaurant in minutes — no card needed."}
                  </p>
                </div>

                {mode === "login" ? (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="login-email" className="text-sm font-medium">
                        Email
                      </Label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="login-email"
                          type="email"
                          placeholder="you@example.com"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          className="pl-10 h-12"
                          autoComplete="email"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="login-password" className="text-sm font-medium">
                        Password
                      </Label>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="login-password"
                          type={showLoginPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className="pl-10 pr-10 h-12"
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword((s) => !s)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={showLoginPassword ? "Hide password" : "Show password"}
                          tabIndex={-1}
                        >
                          {showLoginPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-end -mt-1">
                      <button
                        type="button"
                        onClick={() => setView("forgot-password")}
                        className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                      >
                        Forgot password?
                      </button>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-12 text-base font-semibold gradient-warm text-primary-foreground border-0 glow-primary hover:opacity-90 transition-opacity"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Signing in…
                        </>
                      ) : (
                        "Log In"
                      )}
                    </Button>

                    {googleEnabled !== false && (
                      <>
                        <div className="relative py-1">
                          <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-border/60" />
                          </div>
                          <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
                            <span className="bg-background px-3 text-muted-foreground">or</span>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          className="w-full h-12 text-base font-medium gap-3"
                          onClick={() => handleGoogleSignIn(false)}
                          disabled={isSubmitting || googleEnabled === null}
                        >
                          <GoogleIcon />
                          Continue with Google
                        </Button>
                      </>
                    )}

                    <p className="text-center text-sm text-muted-foreground pt-2">
                      Don't have an account?{" "}
                      <button
                        type="button"
                        onClick={() => setMode("signup")}
                        className="font-semibold text-primary hover:text-primary/80 transition-colors"
                      >
                        Sign up
                      </button>
                    </p>
                  </form>
                ) : (
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-name" className="text-sm font-medium">
                        Full name
                      </Label>
                      <div className="relative">
                        <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-name"
                          type="text"
                          placeholder="Your name"
                          value={signupName}
                          onChange={(e) => setSignupName(e.target.value)}
                          className="pl-10 h-12"
                          autoComplete="name"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="signup-email" className="text-sm font-medium">
                        Email
                      </Label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="you@example.com"
                          value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)}
                          className="pl-10 h-12"
                          autoComplete="email"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="signup-phone" className="text-sm font-medium">
                        Phone number
                      </Label>
                      <div className="relative">
                        <Phone className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-phone"
                          type="tel"
                          placeholder="+91 98765 43210"
                          value={signupPhone}
                          onChange={(e) => setSignupPhone(e.target.value)}
                          className="pl-10 h-12"
                          autoComplete="tel"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="signup-password" className="text-sm font-medium">
                        Password
                      </Label>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-password"
                          type={showSignupPassword ? "text" : "password"}
                          placeholder="At least 6 characters"
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          className="pl-10 pr-10 h-12"
                          autoComplete="new-password"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignupPassword((s) => !s)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={showSignupPassword ? "Hide password" : "Show password"}
                          tabIndex={-1}
                        >
                          {showSignupPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 pt-1">
                      <Checkbox
                        id="accept-terms"
                        checked={signupAcceptedTerms}
                        onCheckedChange={(v) => setSignupAcceptedTerms(v === true)}
                        className="mt-0.5"
                      />
                      <Label
                        htmlFor="accept-terms"
                        className="text-xs text-muted-foreground leading-relaxed font-normal cursor-pointer"
                      >
                        I have read and agree to the{" "}
                        <Link
                          to="/terms"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-2 text-foreground hover:text-primary"
                        >
                          Terms of Service
                        </Link>
                        ,{" "}
                        <Link
                          to="/privacy"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-2 text-foreground hover:text-primary"
                        >
                          Privacy Policy
                        </Link>
                        , and{" "}
                        <Link
                          to="/refund"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-2 text-foreground hover:text-primary"
                        >
                          Refund Policy
                        </Link>
                        .
                      </Label>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-12 text-base font-semibold gradient-warm text-primary-foreground border-0 glow-primary hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isSubmitting || !signupAcceptedTerms}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating account…
                        </>
                      ) : (
                        "Create Account"
                      )}
                    </Button>

                    {googleEnabled !== false && (
                      <>
                        <div className="relative py-1">
                          <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-border/60" />
                          </div>
                          <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
                            <span className="bg-background px-3 text-muted-foreground">or</span>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          className="w-full h-12 text-base font-medium gap-3"
                          onClick={() => handleGoogleSignIn(true)}
                          disabled={isSubmitting || !signupAcceptedTerms || googleEnabled === null}
                          title={
                            !signupAcceptedTerms
                              ? "Please accept the Terms & Policies first"
                              : undefined
                          }
                        >
                          <GoogleIcon />
                          Sign up with Google
                        </Button>
                      </>
                    )}

                    <p className="text-center text-sm text-muted-foreground pt-2">
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => setMode("login")}
                        className="font-semibold text-primary hover:text-primary/80 transition-colors"
                      >
                        Log in
                      </button>
                    </p>
                  </form>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setView("main")}
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to sign in
                </button>

                <div className="space-y-1.5 mb-8">
                  <h1 className="font-display text-3xl font-bold tracking-tight leading-tight">
                    Reset password
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Enter your email and we'll send you a reset link.
                  </p>
                </div>

                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="reset-email" className="text-sm font-medium">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="reset-email"
                        type="email"
                        placeholder="you@example.com"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="pl-10 h-12"
                        autoComplete="email"
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-12 text-base font-semibold gradient-warm text-primary-foreground border-0 glow-primary hover:opacity-90 transition-opacity"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      "Send reset link"
                    )}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link to="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">
              Terms
            </Link>
            <Link to="/refund" className="hover:text-foreground transition-colors">
              Refund
            </Link>
            <Link to="/staff-login" className="hover:text-foreground transition-colors">
              Staff PIN login
            </Link>
          </div>
          <span className="flex items-center gap-1.5">
            <span>© {new Date().getFullYear()}</span>
            <img
              src="/tectangle-logo.png"
              onError={(e) => {
                // Fallback until `public/tectangle-logo.png` is added.
                (e.currentTarget as HTMLImageElement).src = "/logo.png";
              }}
              alt="Tectangle"
              loading="lazy"
              className="h-4 w-4 object-contain"
            />
            <span>Tectangle. All rights reserved.</span>
          </span>
        </footer>
      </div>

      {/* RIGHT: Brand panel */}
      <aside className="relative hidden lg:flex overflow-hidden text-white">
        <div className="absolute inset-0 gradient-warm" />
        {/* Decorative blurs */}
        <div className="absolute -top-32 -right-24 h-96 w-96 rounded-full bg-white/15 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full bg-white/5 blur-2xl" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between w-full p-12 xl:p-16">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-xs font-medium tracking-wide border border-white/20">
              <Sparkles className="h-3.5 w-3.5" />
              One App to Run Your Restaurant
            </span>
          </div>

          <div className="space-y-8">
            <div className="space-y-4 max-w-md">
              <h2 className="font-display text-4xl xl:text-5xl font-bold leading-[1.1] tracking-tight">
                POS, online orders &amp; kitchen — in one place.
              </h2>
              <p className="text-white/85 text-base xl:text-lg leading-relaxed">
                Built for Indian restaurants, cloud kitchens, QSRs and self-service counters.
                Set up in minutes. No setup fee.
              </p>
            </div>

            {/* Feature pills */}
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <FeaturePill icon={Receipt} label="Live KOT printing" />
              <FeaturePill icon={Smartphone} label="UPI & card payments" />
              <FeaturePill icon={ChefHat} label="Self-serve kiosks" />
              <FeaturePill icon={Bike} label="Cloud kitchen ready" />
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm text-white/80">
            <div>
              <div className="font-display font-bold text-2xl text-white">3 mo</div>
              <div className="text-xs">starting plan</div>
            </div>
            <div className="h-10 w-px bg-white/20" />
            <div>
              <div className="font-display font-bold text-2xl text-white">10+</div>
              <div className="text-xs">business types</div>
            </div>
            <div className="h-10 w-px bg-white/20" />
            <div>
              <div className="font-display font-bold text-2xl text-white">24×7</div>
              <div className="text-xs">support</div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function FeaturePill({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 text-sm font-medium">
      <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-white/15 shrink-0">
        <Icon className="h-4 w-4" />
      </span>
      <span className="leading-tight">{label}</span>
    </div>
  );
}

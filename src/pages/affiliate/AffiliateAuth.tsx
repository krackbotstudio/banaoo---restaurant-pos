import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, ArrowLeft, AlertCircle, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Textarea } from "@/components/ui/textarea";
import { API_URL } from "@/lib/api-url";

const emailSchema = z.string().email("Invalid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");
const nameSchema = z.string().min(2, "Name must be at least 2 characters");
const phoneSchema = z.string().min(10, "Phone number must be at least 10 digits");

type AffiliateRecord = {
  id: string;
  status: "pending" | "approved" | "suspended";
  referral_code: string;
};

export default function AffiliateAuth() {
  const { user, loading: authLoading, signIn, signUp, signOut, resetPassword } = useAuth();
  const navigate = useNavigate();

  const [view, setView] = useState<"auth" | "forgot">("auth");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkingAffiliate, setCheckingAffiliate] = useState(false);
  const [affiliate, setAffiliate] = useState<AffiliateRecord | null>(null);

  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup form
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupBusinessName, setSignupBusinessName] = useState("");
  const [signupBusinessType, setSignupBusinessType] = useState("");
  const [signupReason, setSignupReason] = useState("");
  const [signupUpiId, setSignupUpiId] = useState("");

  // Forgot password
  const [resetEmail, setResetEmail] = useState("");

  const statusText = useMemo(() => {
    if (!affiliate) return null;
    if (affiliate.status === "approved") return "Affiliate account approved";
    if (affiliate.status === "pending") return "Application under review";
    return "Affiliate account suspended";
  }, [affiliate]);

  const fetchAffiliate = async () => {
    if (!user) return null;
    const res = await fetch(`${API_URL}/api/affiliate/me`, { credentials: "include" });
    if (!res.ok) return null;
    const payload = await res.json();
    const record = (payload.affiliate || null) as AffiliateRecord | null;
    setAffiliate(record);
    return record;
  };

  useEffect(() => {
    const checkAndRedirect = async () => {
      if (!user) return;

      setCheckingAffiliate(true);
      try {
        const record = await fetchAffiliate();
        if (record?.status === "approved") {
          navigate("/affiliate/dashboard");
        }
      } catch (err) {
        console.error("Error checking affiliate status:", err);
      } finally {
        setCheckingAffiliate(false);
      }
    };

    if (!authLoading && user) {
      checkAndRedirect();
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      emailSchema.parse(loginEmail);
      passwordSchema.parse(loginPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const { error } = await signIn(loginEmail, loginPassword);
      if (error) {
        toast.error(error.message);
        return;
      }

      const meRes = await fetch(`${API_URL}/api/affiliate/me`, { credentials: "include" });
      if (!meRes.ok) {
        toast.error("This account is not registered as an affiliate. Please sign up.");
        await signOut();
        return;
      }
      const payload = await meRes.json();
      const record = (payload.affiliate || null) as AffiliateRecord | null;
      setAffiliate(record);
      if (!record) {
        toast.error("This account is not registered as an affiliate. Please sign up.");
        await signOut();
        return;
      }
      if (record.status === "approved") {
        toast.success("Welcome back!");
        navigate("/affiliate/dashboard");
        return;
      }
      toast.message(record.status === "pending" ? "Application under review." : "Account is suspended.");
    } catch (err) {
      console.error("Login error:", err);
      toast.error("An error occurred during login");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      nameSchema.parse(signupName);
      emailSchema.parse(signupEmail);
      phoneSchema.parse(signupPhone);
      passwordSchema.parse(signupPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const { error: signUpError } = await signUp(signupEmail, signupPassword, signupName, signupPhone);
      if (signUpError) {
        toast.error(signUpError.message);
        return;
      }

      const applyRes = await fetch(`${API_URL}/api/affiliate/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          phone: signupPhone,
          business_name: signupBusinessName || null,
          business_type: signupBusinessType || null,
          reason: signupReason || null,
          payment_details: {
            upi_id: signupUpiId || null,
          },
        }),
      });
      const applyPayload = await applyRes.json().catch(() => ({}));
      if (!applyRes.ok && applyRes.status !== 409) {
        toast.error((applyPayload as { error?: string }).error || "Failed to submit affiliate application");
        return;
      }

      await fetchAffiliate();
      toast.success("Account created! Your affiliate application is now pending approval.");
    } catch (err) {
      console.error("Signup error:", err);
      toast.error("An error occurred during signup");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      emailSchema.parse(resetEmail);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const { error } = await resetPassword(resetEmail);

      if (error) {
        toast.error("Password reset is not yet available. Please contact support.");
        return;
      }

      toast.success("Password reset email sent!");
      setView("auth");
    } catch (err) {
      console.error("Reset error:", err);
      toast.error("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || checkingAffiliate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <Link
          to="/affiliate"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Affiliate Program
        </Link>

        <Card className="border-border/50 shadow-elevated">
          <CardHeader className="text-center pb-4">
            <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mx-auto mb-4">
              <span className="text-primary-foreground font-bold text-xl">A</span>
            </div>
            <CardTitle className="text-2xl">Affiliate Portal</CardTitle>
            <CardDescription>
              {view === "forgot"
                ? "Reset your password"
                : "Sign in or create your affiliate account"}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {affiliate && affiliate.status !== "approved" ? (
              <div className="space-y-4">
                <div className={`rounded-lg border p-4 ${affiliate.status === "pending" ? "border-amber-200 bg-amber-50/50" : "border-destructive/30 bg-destructive/5"}`}>
                  <div className="flex items-start gap-3">
                    {affiliate.status === "pending" ? (
                      <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold">{statusText}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {affiliate.status === "pending"
                          ? "Your profile has been submitted. You can access the dashboard once our admin approves your application."
                          : "Please contact support to reactivate your affiliate account."}
                      </p>
                    </div>
                  </div>
                </div>
                <Button variant="outline" className="w-full" onClick={() => void signOut()}>
                  Sign Out
                </Button>
              </div>
            ) : view === "forgot" ? (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="you@example.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send Reset Link
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setView("auth")}
                >
                  Back to Sign In
                </Button>
              </form>
            ) : (
              <Tabs defaultValue="login" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Sign In</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="you@example.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Sign In
                    </Button>
                    <button
                      type="button"
                      onClick={() => setView("forgot")}
                      className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Forgot password?
                    </button>
                  </form>
                </TabsContent>

                <TabsContent value="signup">
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Full Name</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="John Doe"
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="you@example.com"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-phone">Phone Number</Label>
                      <Input
                        id="signup-phone"
                        type="tel"
                        placeholder="+91 98765 43210"
                        value={signupPhone}
                        onChange={(e) => setSignupPhone(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-business-name">Business / Network Name (optional)</Label>
                      <Input
                        id="signup-business-name"
                        type="text"
                        placeholder="Food Consultant Network"
                        value={signupBusinessName}
                        onChange={(e) => setSignupBusinessName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-business-type">Business Type (optional)</Label>
                      <Input
                        id="signup-business-type"
                        type="text"
                        placeholder="Consultant, Agency, Influencer"
                        value={signupBusinessType}
                        onChange={(e) => setSignupBusinessType(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-upi">UPI ID (optional)</Label>
                      <Input
                        id="signup-upi"
                        type="text"
                        placeholder="yourname@upi"
                        value={signupUpiId}
                        onChange={(e) => setSignupUpiId(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="••••••••"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-reason">Why do you want to join? (optional)</Label>
                      <Textarea
                        id="signup-reason"
                        placeholder="Tell us how you will bring restaurant referrals."
                        value={signupReason}
                        onChange={(e) => setSignupReason(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create Account
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      By signing up, you agree to our Terms of Service and Privacy Policy
                    </p>
                  </form>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

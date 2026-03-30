import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { z } from "zod";

const emailSchema = z.string().email("Invalid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");
const nameSchema = z.string().min(2, "Name must be at least 2 characters");
const phoneSchema = z.string().min(10, "Phone number must be at least 10 digits");

export default function AffiliateAuth() {
  const { user, loading: authLoading, signIn, signUp, signOut, resetPassword } = useAuth();
  const navigate = useNavigate();

  const [view, setView] = useState<"auth" | "forgot">("auth");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkingAffiliate, setCheckingAffiliate] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup form
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  // Forgot password
  const [resetEmail, setResetEmail] = useState("");

  // Check if user is already an affiliate
  useEffect(() => {
    const checkAndRedirect = async () => {
      if (!user) return;

      setCheckingAffiliate(true);
      try {
        const { data, error } = await supabase
          .from("affiliates")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (data && !error) {
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

  const generateReferralCode = (name: string): string => {
    const prefix = name.replace(/\s+/g, "").substring(0, 4).toUpperCase();
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${randomSuffix}`;
  };

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

      // Check if user is an affiliate in the database
      if (user) {
        const { data: affiliateData } = await supabase
          .from("affiliates")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (!affiliateData) {
          toast.error("This account is not registered as an affiliate. Please sign up.");
          await signOut();
          return;
        }

        toast.success("Welcome back!");
        navigate("/affiliate/dashboard");
      }
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
      // Sign up the user using our new backend
      const { error: signUpError } = await signUp(signupEmail, signupPassword, signupName);
      if (signUpError) {
        toast.error(signUpError.message);
        return;
      }

      // User is now logged in via signUp() call automatically in our backend
      if (!user) {
        toast.error("Failed to create account");
        return;
      }

      // Update profile with phone
      await supabase
        .from("profiles")
        .update({ phone: signupPhone, role: "affiliate" })
        .eq("user_id", user.id);

      // Create affiliate record
      const referralCode = generateReferralCode(signupName);
      const { error: affiliateError } = await supabase.from("affiliates").insert({
        user_id: user.id,
        referral_code: referralCode,
        status: "pending",
        payment_details: {},
      });

      if (affiliateError) {
        console.error("Error creating affiliate:", affiliateError);
        toast.error("Failed to create affiliate account");
        return;
      }

      toast.success("Account created! Your affiliate application is now pending approval.");
      navigate("/affiliate/dashboard");
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
            {view === "forgot" ? (
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

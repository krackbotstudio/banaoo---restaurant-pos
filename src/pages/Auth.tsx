import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ChefHat, Loader2, Sparkles, ArrowLeft } from "lucide-react";

const emailSchema = z.string().email("Please enter a valid email");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

type AuthView = "main" | "forgot-password";

export default function Auth() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [view, setView] = useState<AuthView>("main");
  
  // Clear orphaned sessions on mount
  useEffect(() => {
    const clearOrphanedSession = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL ?? "";
        const res = await fetch(`${API_URL}/auth/me`, { credentials: "include" });
        
        if (res.status === 401) {
          // Session exists but user not authenticated - might be orphaned
          console.log('Detected potential orphaned session, clearing...');
          await fetch(`${API_URL}/auth/clear-session`, { 
            method: 'POST',
            credentials: 'include'
          });
        }
      } catch (err) {
        console.error('Error checking/clearing session:', err);
      }
    };
    
    clearOrphanedSession();
  }, []);
  
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  const [resetEmail, setResetEmail] = useState("");

  const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    try {
      console.log('Initiating Google sign-in...');
      const API_URL = import.meta.env.VITE_API_URL ?? "";
      const googleUrl = `${API_URL}/auth/google`;
      console.log('Redirecting to:', googleUrl);
      
      // Test if the endpoint exists first
      try {
        const testResponse = await fetch(googleUrl, { method: 'GET', redirect: 'manual' });
        console.log('Google endpoint response:', testResponse.status);
      } catch (fetchError) {
        console.warn('Could not test endpoint (this is OK for redirects):', fetchError.message);
      }
      
      // Use window.location instead of returning from function
      window.location.href = googleUrl;
      
      // Don't reset submitting - page will redirect
    } catch (error) {
      console.error('Google sign-in error:', error);
      setIsSubmitting(false);
      toast({
        variant: "destructive",
        title: "Google Sign-In Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  // Capture referral code from URL and store in localStorage
  useEffect(() => {
    const refCode = searchParams.get("ref");
    if (refCode) {
      localStorage.setItem("banaoo_referral_code", refCode);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!loading && user && profile) {
      navigate("/dashboard");
    }
  }, [user, loading, profile, navigate]);

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
          description: err.errors[0].message
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
        description: error.message
      });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signupName.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please enter your name"
      });
      return;
    }

    try {
      emailSchema.parse(signupEmail);
      passwordSchema.parse(signupPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: err.errors[0].message
        });
        return;
      }
    }

    setIsSubmitting(true);
    const { error } = await signUp(signupEmail, signupPassword, signupName);
    setIsSubmitting(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Signup Failed",
        description: error.message
      });
    } else {
      toast({
        title: "Account Created!",
        description: "Welcome! Please choose a plan to get started."
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
          description: err.errors[0].message
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
        description: "Password reset via email is not yet implemented in the custom backend. Please contact support."
      });
    } else {
      // This path is currently unreachable given the placeholder in auth.tsx
      toast({
        title: "Success",
        description: "Password reset request processed."
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: "2s" }} />
      </div>

      <div className="w-full max-w-md space-y-8 relative z-10 animate-fade-in">
        {/* Back Button */}
        <Button
          variant="ghost"
          asChild
          className="absolute top-0 left-0 -translate-y-2"
        >
          <Link to="/" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </Button>

        {/* Logo & Branding */}
        <div className="flex flex-col items-center space-y-4 pt-8">
          <div className="flex items-center justify-center h-20 w-20 rounded-2xl gradient-warm glow-primary animate-float">
            <ChefHat className="h-10 w-10 text-white" />
          </div>
          <div className="text-center">
            <h1 className="font-display text-4xl font-bold tracking-tight">banaoo.io</h1>
            <p className="text-muted-foreground mt-2 flex items-center justify-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              One App to Run Your Restaurant
            </p>
          </div>
        </div>

        {/* Auth Card */}
        <Card className="glass-strong border-border/50 shadow-warm">
          {view === "main" ? (
            <>
              <CardHeader className="space-y-1 pb-4 text-center">
                <CardTitle className="font-display text-2xl">Welcome</CardTitle>
                <CardDescription>
                  Sign in or create your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="login" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/50 p-1">
                    <TabsTrigger value="login" className="font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
                      Login
                    </TabsTrigger>
                    <TabsTrigger value="signup" className="font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
                      Sign Up
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="login" className="space-y-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-12 text-base font-medium border-border/60 bg-background/50 hover:bg-muted/50 flex items-center gap-3"
                      onClick={handleGoogleSignIn}
                      disabled={isSubmitting}
                    >
                      <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      Continue with Google
                    </Button>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border/40" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">or continue with email</span>
                      </div>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="login-email" className="text-sm font-medium">Email</Label>
                        <Input
                          id="login-email"
                          type="email"
                          placeholder="you@example.com"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          className="h-12 bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20"
                          autoComplete="email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="login-password" className="text-sm font-medium">Password</Label>
                        <Input
                          id="login-password"
                          type="password"
                          placeholder="••••••••"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className="h-12 bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20"
                          autoComplete="current-password"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="link"
                        className="p-0 h-auto text-sm text-muted-foreground hover:text-primary"
                        onClick={() => setView("forgot-password")}
                      >
                        Forgot password?
                      </Button>
                      <Button 
                        type="submit" 
                        className="w-full h-12 text-base font-semibold gradient-warm text-white border-0 glow-primary hover:opacity-90 transition-opacity"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Signing in...
                          </>
                        ) : (
                          "Sign In"
                        )}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="signup" className="space-y-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-12 text-base font-medium border-border/60 bg-background/50 hover:bg-muted/50 flex items-center gap-3"
                      onClick={handleGoogleSignIn}
                      disabled={isSubmitting}
                    >
                      <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      Continue with Google
                    </Button>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border/40" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">or sign up with email</span>
                      </div>
                    </div>

                    <form onSubmit={handleSignup} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="signup-name" className="text-sm font-medium">Full Name</Label>
                        <Input
                          id="signup-name"
                          type="text"
                          placeholder="Your Name"
                          value={signupName}
                          onChange={(e) => setSignupName(e.target.value)}
                          className="h-12 bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20"
                          autoComplete="name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-email" className="text-sm font-medium">Email</Label>
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="you@example.com"
                          value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)}
                          className="h-12 bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20"
                          autoComplete="email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-password" className="text-sm font-medium">Password</Label>
                        <Input
                          id="signup-password"
                          type="password"
                          placeholder="••••••••"
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          className="h-12 bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20"
                          autoComplete="new-password"
                        />
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full h-12 text-base font-semibold gradient-warm text-white border-0 glow-primary hover:opacity-90 transition-opacity"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating account...
                          </>
                        ) : (
                          "Create Account"
                        )}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="space-y-1 pb-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-fit -ml-2 mb-2"
                  onClick={() => setView("main")}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <CardTitle className="font-display text-2xl">Reset Password</CardTitle>
                <CardDescription>
                  Enter your email and we'll send you a reset link
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email" className="text-sm font-medium">Email</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="you@example.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="h-12 bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20"
                      autoComplete="email"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-12 text-base font-semibold gradient-warm text-white border-0 glow-primary hover:opacity-90 transition-opacity"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Send Reset Link"
                    )}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Powered by AI • Made for Restaurant Owners
        </p>

        <div className="text-center">
          <Link
            to="/staff-login"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground/70 hover:text-muted-foreground transition-colors"
          >
            Staff member? Login with your PIN
          </Link>
        </div>
      </div>
    </div>
  );
}

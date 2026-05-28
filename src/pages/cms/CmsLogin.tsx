import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCmsAuth } from "@/lib/cms-auth";
import { toast } from "sonner";

export default function CmsLogin() {
  const { admin, loading, signIn } = useCmsAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && admin) {
      navigate("/cms/dashboard", { replace: true });
    }
  }, [admin, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Welcome back");
    navigate("/cms/dashboard", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <img src="/tectangle-logo.png" alt="Tectangle" className="h-14 w-14 object-contain" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Tectangle CMS</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Platform administration for Banaoo
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
            <div className="space-y-2">
              <Label htmlFor="cms-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="cms-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@tectangle.com"
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cms-password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="cms-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Restaurant owners sign in at{" "}
            <a href="/auth" className="text-primary hover:underline">
              banaoo.io/auth
            </a>
          </p>
        </div>
      </div>

      <footer className="py-6 text-center text-xs text-muted-foreground border-t">
        <span className="inline-flex items-center gap-1.5">
          © {year}
          <img src="/tectangle-logo.png" alt="" className="h-3.5 w-3.5 object-contain inline" aria-hidden />
          Tectangle. All rights reserved.
        </span>
      </footer>
    </div>
  );
}

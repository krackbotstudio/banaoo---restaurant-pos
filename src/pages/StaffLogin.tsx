import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, KeyRound, AlertTriangle } from "lucide-react";

const STAFF_EMAIL_DOMAIN = "banaoo-staff.app";
const PIN_PREFIX = "bn_";

export default function StaffLogin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn, user, profile } = useAuth();

  const [username, setUsername] = useState("");
  const [pin, setPin] = useState(["", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pinRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const newPin = [...pin];
    newPin[index] = digit;
    setPin(newPin);
    if (digit && index < 3) {
      pinRefs[index + 1].current?.focus();
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      pinRefs[index - 1].current?.focus();
    }
  };

  const handlePinPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (text.length === 4) {
      setPin(text.split(""));
      pinRefs[3].current?.focus();
    }
    e.preventDefault();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUsername = username.trim().toLowerCase();
    const pinValue = pin.join("");

    if (!trimmedUsername) {
      toast({ variant: "destructive", title: "Enter your username" });
      return;
    }
    if (pinValue.length !== 4) {
      toast({ variant: "destructive", title: "Enter your 4-digit PIN" });
      return;
    }

    setIsSubmitting(true);
    try {
      const systemEmail = `${trimmedUsername}@${STAFF_EMAIL_DOMAIN}`;
      const { error } = await signIn(systemEmail, PIN_PREFIX + pinValue);

      if (error) {
        toast({
          variant: "destructive",
          title: "Login failed",
          description: "Invalid username or PIN. Check with your manager.",
        });
        setPin(["", "", "", ""]);
        pinRefs[0].current?.focus();
        return;
      }

      navigate("/dashboard");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center">
            <div className="p-3 rounded-2xl gradient-primary glow-primary">
              <img src="/logo.png" alt="Banaoo" className="h-8 w-8 object-contain brightness-0 invert" />
            </div>
          </div>
          <h1 className="font-display text-2xl font-bold">Staff Login</h1>
          <p className="text-sm text-muted-foreground">
            Enter your username and PIN to access your workspace
          </p>
        </div>

        {/* Session conflict warning */}
        {user && (
          <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              This browser has an active session
              {profile?.full_name ? ` (${profile.full_name})` : ""}.
              Signing in as staff will replace it — use a private window to keep both sessions separate.
            </span>
          </div>
        )}

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username */}
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              placeholder="e.g. ravi.a3f2"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-12 font-mono"
              autoFocus
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>

          {/* PIN */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <KeyRound className="h-3.5 w-3.5" />
              4-Digit PIN
            </Label>
            <div className="flex gap-3 justify-center" onPaste={handlePinPaste}>
              {pin.map((digit, i) => (
                <Input
                  key={i}
                  ref={pinRefs[i]}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handlePinChange(i, e.target.value)}
                  onKeyDown={(e) => handlePinKeyDown(i, e)}
                  className="w-14 h-14 text-center text-2xl font-bold tracking-widest p-0"
                  autoComplete="off"
                />
              ))}
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-12 gradient-primary glow-primary text-base font-semibold"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              "Sign In"
            )}
          </Button>
        </form>

        {/* Back to owner login */}
        <div className="text-center">
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Owner login
          </Link>
        </div>
      </div>
    </div>
  );
}

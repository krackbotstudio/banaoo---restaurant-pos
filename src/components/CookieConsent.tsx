import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Cookie, X } from "lucide-react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "cookie_consent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // Small delay so it doesn't flash on page load
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(STORAGE_KEY, "accepted");
    setVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem(STORAGE_KEY, "declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 animate-slide-up">
      <div className="rounded-2xl border border-border bg-background/95 backdrop-blur-md shadow-xl shadow-black/10 p-5">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Cookie className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <p className="text-sm font-semibold">We use cookies</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We use cookies to improve your experience, analyse site usage, and
              personalise content. See our{" "}
              <Link
                to="/privacy"
                className="text-primary underline underline-offset-2 hover:no-underline"
              >
                Privacy Policy
              </Link>{" "}
              for details.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleAccept}
                className="gradient-warm text-white border-0 h-8 px-4 text-xs hover:opacity-90 transition-opacity"
              >
                Accept All
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDecline}
                className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
              >
                Decline
              </Button>
            </div>
          </div>
          <button
            onClick={handleDecline}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

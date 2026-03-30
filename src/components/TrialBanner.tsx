import { Link } from "react-router-dom";
import { AlertCircle, Clock, CreditCard, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/use-subscription";
import { useState } from "react";

export function TrialBanner() {
  const { hasActiveSubscription, daysUntilExpiry, loading } = useSubscription();
  const [isDismissed, setIsDismissed] = useState(false);

  // Don't show while loading, if dismissed, or if subscription is healthy (>7 days)
  if (loading || isDismissed || !hasActiveSubscription || daysUntilExpiry > 7) return null;

  // Expiring today
  if (daysUntilExpiry === 0) {
    return (
      <div className="w-full bg-destructive text-destructive-foreground sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-4 w-4 shrink-0 animate-pulse" />
            <span className="text-sm font-medium">
              ⏰ Your subscription expires today! Renew now to avoid losing access.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" className="shrink-0 h-7 text-xs" asChild>
              <Link to="/settings?tab=subscription">
                <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                Renew Now
              </Link>
            </Button>
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 1–3 days left (high urgency)
  if (daysUntilExpiry <= 3) {
    return (
      <div className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">
              🔥 Only {daysUntilExpiry} day{daysUntilExpiry === 1 ? "" : "s"} left on your subscription. Renew to avoid interruption.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" className="shrink-0 h-7 text-xs" asChild>
              <Link to="/settings?tab=subscription">
                <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                Renew Now
              </Link>
            </Button>
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4–7 days left (medium urgency)
  return (
    <div className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Clock className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">
            ⚡ {daysUntilExpiry} days left on your subscription. Renew early to save more with multi-month discounts.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" className="shrink-0 h-7 text-xs" asChild>
            <Link to="/settings?tab=subscription">
              <CreditCard className="h-3.5 w-3.5 mr-1.5" />
              Renew Plan
            </Link>
          </Button>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

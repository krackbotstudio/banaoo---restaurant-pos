import { ReactNode } from "react";
import { useFeatureGating, FeatureKey } from "@/hooks/use-feature-gating";
import { Lock, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface FeatureGateProps {
  feature: FeatureKey;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
  className?: string;
}

export function FeatureGate({
  feature,
  children,
  fallback,
  showUpgradePrompt = true,
  className,
}: FeatureGateProps) {
  const navigate = useNavigate();
  const { canAccess, getUpgradeMessage, isAddonFeature, loading } = useFeatureGating();

  if (loading) {
    return (
      <div className={cn("flex justify-center items-center py-16", className)}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (canAccess(feature)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgradePrompt) {
    return null;
  }

  return (
    <div
      className={cn(
        "relative rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 text-center",
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-lg" />
      <div className="relative">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-semibold text-lg mb-2">Premium Feature</h3>
        <p className="text-muted-foreground text-sm mb-4">
          {getUpgradeMessage(feature)}
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          {isAddonFeature(feature) && (
            <Button variant="outline" onClick={() => navigate("/addons")} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Buy add-on
            </Button>
          )}
          <Button onClick={() => navigate("/pricing")} className="gap-2">
            <Sparkles className="h-4 w-4" />
            {isAddonFeature(feature) ? "View plans" : "Upgrade Plan"}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface FeatureBadgeProps {
  feature: FeatureKey;
  children: ReactNode;
}

export function FeatureBadge({ feature, children }: FeatureBadgeProps) {
  const { canAccess } = useFeatureGating();

  if (canAccess(feature)) {
    return <>{children}</>;
  }

  return (
    <div className="relative inline-flex items-center">
      {children}
      <Lock className="h-3 w-3 text-muted-foreground ml-1" />
    </div>
  );
}

interface LimitIndicatorProps {
  feature: FeatureKey;
  currentCount: number;
  label?: string;
}

export function LimitIndicator({
  feature,
  currentCount,
  label,
}: LimitIndicatorProps) {
  const navigate = useNavigate();
  const { getLimit, isWithinLimit, getUpgradeMessage, isAddonFeature } = useFeatureGating();
  const limit = getLimit(feature);
  const withinLimit = isWithinLimit(feature, currentCount);

  if (typeof limit !== "number") return null;

  const isUnlimited = limit === Infinity;

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label || feature}:</span>
      <span
        className={cn(
          "font-medium",
          !withinLimit && "text-destructive"
        )}
      >
        {currentCount} / {isUnlimited ? "∞" : limit}
      </span>
      {!withinLimit && (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs"
          onClick={() => navigate(isAddonFeature(feature) ? "/addons" : "/pricing")}
        >
          {isAddonFeature(feature) ? "Add capacity" : "Upgrade"}
        </Button>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useSubscription } from "@/hooks/use-subscription";
import { getAddonCatalogItem, getPlanDisplayName, type AddonType } from "@/lib/plans";
import { Loader2, Smartphone, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const API_URL = import.meta.env.VITE_API_URL ?? "";

interface CheckoutIntent {
  kind: "subscription" | "addon";
  plan_type?: "starter" | "professional";
  period_months: number;
  addon_type?: string;
  quantity?: number;
  from_mobile?: boolean;
}

export default function BillingCheckout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { createOrder, purchaseAddon } = useSubscription();
  const token = searchParams.get("token");
  const fromMobile = searchParams.get("from") === "mobile";
  const [intent, setIntent] = useState<CheckoutIntent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      if (token) {
        window.location.href = `${API_URL}/api/billing/redeem?token=${encodeURIComponent(token)}`;
      } else {
        navigate("/auth", { replace: true });
      }
      return;
    }
    if (!token) {
      setError("Missing checkout link. Open subscription from the app or Settings.");
      return;
    }

    (async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/billing/checkout-intent?token=${encodeURIComponent(token)}`,
          { credentials: "include" }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Invalid checkout session");
        setIntent(data as CheckoutIntent);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load checkout");
      }
    })();
  }, [authLoading, user, token, navigate]);

  useEffect(() => {
    if (!intent || startedRef.current || done || error) return;
    startedRef.current = true;

    (async () => {
      setPaying(true);
      try {
        let ok = false;
        if (intent.kind === "subscription" && intent.plan_type) {
          ok = await createOrder(intent.plan_type, intent.period_months);
        } else if (intent.kind === "addon" && intent.addon_type) {
          ok = await purchaseAddon(
            intent.addon_type as AddonType,
            intent.quantity ?? 1,
            intent.period_months
          );
        } else {
          throw new Error("Invalid checkout type");
        }
        if (ok) {
          setDone(true);
          if (fromMobile) {
            setTimeout(() => {
              window.location.href = "banaoo://billing/complete";
            }, 1500);
          }
        } else {
          setError("Payment was not completed.");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Payment failed");
      } finally {
        setPaying(false);
      }
    })();
  }, [intent, done, error, fromMobile, createOrder, purchaseAddon]);

  const title =
    intent?.kind === "subscription" && intent.plan_type
      ? `${getPlanDisplayName(intent.plan_type)} — ${intent.period_months} month${intent.period_months > 1 ? "s" : ""}`
      : intent?.kind === "addon" && intent.addon_type
        ? `${getAddonCatalogItem(intent.addon_type as AddonType)?.name ?? "Add-on"} checkout`
        : "Banaoo checkout";

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            {done ? (
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            ) : error ? (
              <AlertCircle className="h-6 w-6 text-destructive" />
            ) : (
              <Smartphone className="h-6 w-6 text-primary" />
            )}
          </div>
          <CardTitle>{done ? "Payment successful" : title}</CardTitle>
          <CardDescription>
            {fromMobile
              ? "Complete payment in your browser. Return to the Banaoo app when finished."
              : "Secure checkout powered by Razorpay"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {paying && !error && !done && (
            <div className="flex flex-col items-center gap-2 py-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Opening Razorpay…</p>
            </div>
          )}
          {done && (
            <p className="text-sm text-muted-foreground">
              {fromMobile
                ? "Redirecting you back to the app…"
                : "Your account has been updated."}
            </p>
          )}
          {!paying && (
            <div className="flex flex-col gap-2">
              {done && fromMobile && (
                <Button asChild variant="default">
                  <a href="banaoo://billing/complete">Open Banaoo app</a>
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate("/settings?tab=subscription")}>
                Go to Settings
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

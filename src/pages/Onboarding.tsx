import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  UtensilsCrossed,
  Building2,
  ChefHat,
  Coffee,
  Zap,
  Wine,
  ArrowRight,
  ArrowLeft,
  Loader2,
} from "lucide-react";

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

const BUSINESS_TYPES = [
  { id: "restaurant", label: "Restaurant", icon: UtensilsCrossed, description: "Dine-in & takeaway" },
  { id: "hotel", label: "Hotel", icon: Building2, description: "Hotel dining & room service" },
  { id: "cloud_kitchen", label: "Cloud Kitchen", icon: ChefHat, description: "Delivery-only kitchen" },
  { id: "cafe", label: "Cafe", icon: Coffee, description: "Coffee shop & cafe" },
  { id: "qsr", label: "QSR", icon: Zap, description: "Quick service restaurant" },
  { id: "bar", label: "Bar & Lounge", icon: Wine, description: "Bar, pub & lounge" },
];

export default function Onboarding() {
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [businessType, setBusinessType] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);

  const handleSkip = async () => {
    setIsSkipping(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL ?? "";
      const res = await fetch(`${API_URL}/api/onboarding/skip`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        let message = "Failed to skip onboarding";
        try { message = JSON.parse(text).error || message; } catch { /* HTML response */ }
        throw new Error(message);
      }
      await refreshProfile();
      navigate("/dashboard");
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Something went wrong",
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setIsSkipping(false);
    }
  };

  const handleContinue = () => {
    if (!businessType) {
      toast({ variant: "destructive", title: "Please select a business type" });
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim()) {
      toast({ variant: "destructive", title: "Please enter your business name" });
      return;
    }

    setIsSubmitting(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL ?? "";
      const res = await fetch(`${API_URL}/api/onboarding/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          business_type: businessType,
          brand_name: businessName.trim(),
          ordering_slug: generateSlug(businessName.trim()),
          phone: phone.trim() || null,
          city: city.trim() || null,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        let message = "Failed to complete onboarding";
        try { message = JSON.parse(text).error || message; } catch { /* HTML response */ }
        throw new Error(message);
      }
      await refreshProfile();
      navigate("/dashboard");
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Something went wrong",
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-2xl relative z-10 animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center h-16 w-16 rounded-2xl gradient-warm mx-auto mb-4">
            <ChefHat className="h-8 w-8 text-white" />
          </div>
          <h1 className="font-display text-3xl font-bold">Welcome to banaoo.io</h1>
          <p className="text-muted-foreground mt-2">Let's set up your account in 2 quick steps</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3 mb-8 max-w-xs mx-auto">
          <div className={`h-2 flex-1 rounded-full transition-colors ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
          <div className={`h-2 flex-1 rounded-full transition-colors ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
        </div>

        {/* Step 1: Business Type */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="font-display text-xl font-semibold">What best describes your business?</h2>
              <p className="text-sm text-muted-foreground mt-1">Step 1 of 2</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {BUSINESS_TYPES.map(({ id, label, icon: Icon, description }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setBusinessType(id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all hover:border-primary/60 hover:bg-primary/5 ${
                    businessType === id
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border/50 bg-card"
                  }`}
                >
                  <div className={`inline-flex p-2 rounded-lg mb-3 ${businessType === id ? "bg-primary/20" : "bg-muted"}`}>
                    <Icon className={`h-5 w-5 ${businessType === id ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <p className={`font-semibold text-sm ${businessType === id ? "text-primary" : ""}`}>{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                </button>
              ))}
            </div>

            <Button
              className="w-full h-12 text-base font-semibold gradient-warm text-white border-0 glow-primary"
              onClick={handleContinue}
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            <button
              type="button"
              onClick={handleSkip}
              disabled={isSkipping}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2 flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isSkipping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Skip for now — I'll set this up later
            </button>
          </div>
        )}

        {/* Step 2: Business Details */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="font-display text-xl font-semibold">Tell us about your business</h2>
              <p className="text-sm text-muted-foreground mt-1">Step 2 of 2</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
              <div className="space-y-2">
                <Label htmlFor="business-name" className="text-sm font-medium">
                  Business Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="business-name"
                  type="text"
                  placeholder="e.g. Spice Garden Restaurant"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="h-12 bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium">
                  Phone Number <span className="text-muted-foreground text-xs">(optional)</span>
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-12 bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city" className="text-sm font-medium">
                  City / Location <span className="text-muted-foreground text-xs">(optional)</span>
                </Label>
                <Input
                  id="city"
                  type="text"
                  placeholder="e.g. Mumbai, Delhi, Bangalore"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="h-12 bg-background/50 border-border/50 focus:border-primary focus:ring-primary/20"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 px-6"
                  onClick={() => setStep(1)}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-12 text-base font-semibold gradient-warm text-white border-0 glow-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      Get Started
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>

              <button
                type="button"
                onClick={handleSkip}
                disabled={isSkipping}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors pt-1 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isSkipping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Skip for now — I'll set this up later
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

import { Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { API_URL } from "@/lib/api-url";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { SEO, StructuredData, buildFaqPage } from "@/components/seo/SEO";
import {
  UtensilsCrossed,
  LayoutDashboard,
  ClipboardList,
  ChefHat,
  Users,
  Zap,
  BarChart3,
  ArrowRight,
  Star,
  CheckCircle2,
  TrendingUp,
  Shield,
  Smartphone,
  Globe,
  Clock,
  Headphones,
  Download,
  Loader2,
} from "lucide-react";

// ─── Hero videos ─────────────────────────────────────────────────────────────

const heroVideos = [
  "/Videos/hero-loop.mp4",
  "/Videos/hero-orders.mp4",
];

// ─── Typing words (Flaze and food-service variants) ───────────────────────────

const typingWords = [
  "Flaze!",
];

// ─── Data ────────────────────────────────────────────────────────────────────

const stats = [
  { value: "500+", label: "Restaurants" },
  { value: "1M+", label: "Orders Processed" },
  { value: "99.9%", label: "Uptime" },
  { value: "4.9★", label: "Average Rating" },
];

const platforms = [
  "Zomato",
  "Swiggy",
  "Razorpay",
  "WhatsApp",
  "Google Maps",
  "Google Pay",
  "PhonePe",
  "Paytm",
  "Zomato",
  "Swiggy",
  "Razorpay",
  "WhatsApp",
  "Google Maps",
  "Google Pay",
  "PhonePe",
  "Paytm",
];

const features = [
  {
    icon: LayoutDashboard,
    title: "Multi-Outlet Dashboard",
    description:
      "Control every location from a single screen — real-time sales, staff, and orders at a glance.",
    large: true,
  },
  {
    icon: ClipboardList,
    title: "Smart Order Management",
    description:
      "Dine-in, takeaway, delivery — every order channel in one place.",
    large: false,
  },
  {
    icon: ChefHat,
    title: "Kitchen Display System",
    description: "Live KDS so your kitchen never misses a ticket.",
    large: false,
  },
  {
    icon: Zap,
    title: "AI Menu Import",
    description:
      "Snap a photo of your menu and we'll import it instantly using AI.",
    large: false,
  },
  {
    icon: Users,
    title: "Staff & Role Management",
    description: "PIN-based staff logins with granular permission controls.",
    large: false,
  },
  {
    icon: BarChart3,
    title: "Analytics & Reports",
    description: "Daily, weekly, monthly — know exactly what's working.",
    large: false,
  },
];

const steps = [
  {
    number: "01",
    title: "Set up your restaurant",
    description:
      "Add your outlets, build your menu with AI help, and invite your staff — all in under 10 minutes.",
    icon: UtensilsCrossed,
  },
  {
    number: "02",
    title: "Start taking orders",
    description:
      "Use our POS for dine-in, the Kitchen Display for your team, and sync delivery orders automatically.",
    icon: ClipboardList,
  },
  {
    number: "03",
    title: "Grow your business",
    description:
      "Unlock analytics, integrations, and insights that help you make smarter decisions every day.",
    icon: TrendingUp,
  },
];

const testimonials = [
  {
    quote:
      "Flaze cut our order errors by 80%. The kitchen display alone was worth the switch. Setup was genuinely 10 minutes.",
    name: "Rohan Mehta",
    restaurant: "Spice Garden",
    city: "Mumbai",
    initials: "RM",
    stars: 5,
  },
  {
    quote:
      "We run 4 outlets and managing them all from one screen is a game-changer. Reports are fantastic.",
    name: "Priya Sharma",
    restaurant: "The Curry Co.",
    city: "Bengaluru",
    initials: "PS",
    stars: 5,
  },
  {
    quote:
      "Imported our full 120-item menu in under 2 minutes with the AI feature. Absolutely brilliant.",
    name: "Arjun Nair",
    restaurant: "Coastal Bites",
    city: "Kochi",
    initials: "AN",
    stars: 5,
  },
];

const whyItems = [
  { icon: Shield, label: "Bank-grade security" },
  { icon: Smartphone, label: "Works on any device" },
  { icon: Globe, label: "Multi-outlet ready" },
  { icon: Clock, label: "Setup in minutes" },
  { icon: Zap, label: "AI-powered tools" },
  { icon: Headphones, label: "Priority support" },
  { icon: TrendingUp, label: "Real-time analytics" },
  { icon: CheckCircle2, label: "No hardware needed" },
  { icon: BarChart3, label: "Daily reports" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const marqueeRef = useRef<HTMLDivElement>(null);
  const [videoIndex, setVideoIndex] = useState(0);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [downloadEmail, setDownloadEmail] = useState("");
  const [downloadPhone, setDownloadPhone] = useState("");
  const [downloadSubmitting, setDownloadSubmitting] = useState(false);

  // Typing animation
  const [typedText, setTypedText] = useState("");
  const [wordIdx, setWordIdx] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentWord = typingWords[wordIdx];
    const isFull = typedText === currentWord;
    const delay = isDeleting ? 55 : isFull ? 1800 : 100;

    const t = setTimeout(() => {
      if (!isDeleting) {
        if (!isFull) {
          setTypedText(currentWord.slice(0, typedText.length + 1));
        } else {
          setIsDeleting(true);
        }
      } else {
        if (typedText.length > 0) {
          setTypedText(currentWord.slice(0, typedText.length - 1));
        } else {
          setIsDeleting(false);
          setWordIdx((i) => (i + 1) % typingWords.length);
        }
      }
    }, delay);

    return () => clearTimeout(t);
  }, [typedText, wordIdx, isDeleting]);

  useEffect(() => {
    if (!user) return;
    // Send any logged-in user to /dashboard — ProtectedRoute handles
    // the subscription → onboarding → dashboard flow from there.
    navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  // Only hide when we KNOW a user is logged in — redirect is imminent via useEffect.
  // Never block on loading: if auth is slow to initialise the page stays blank.
  if (user) return null;

  const handleDownloadApp = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = downloadEmail.trim();
    const phone = downloadPhone.trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ variant: "destructive", title: "Enter a valid email address" });
      return;
    }
    if (!phone || !/^[+]?[0-9\s-]{10,15}$/.test(phone)) {
      toast({ variant: "destructive", title: "Enter a valid contact number" });
      return;
    }

    const apiBase = API_URL || window.location.origin;
    setDownloadSubmitting(true);
    try {
      const response = await fetch(`${apiBase}/api/mobile-app/download-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          phone,
          source: "landing_hero",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Could not generate download link");
      }

      const downloadUrl = (data as { downloadUrl?: string }).downloadUrl;
      if (!downloadUrl) throw new Error("Download URL is missing");

      const siteOrigin = window.location.origin;
      const resolvedUrl = downloadUrl.startsWith("http")
        ? downloadUrl
        : `${siteOrigin}${downloadUrl.startsWith("/") ? downloadUrl : `/${downloadUrl}`}`;

      const anchor = document.createElement("a");
      anchor.href = resolvedUrl;
      anchor.download = "flaze-app-latest.apk";
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      toast({
        title: "Download started",
        description: "If nothing happens, check your browser downloads or allow downloads from this site.",
      });
      setDownloadDialogOpen(false);
      setDownloadEmail("");
      setDownloadPhone("");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Download failed",
        description: error instanceof Error ? error.message : "Please try again",
      });
    } finally {
      setDownloadSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        title="Flaze — One App to Run Your Restaurant | POS, Online Orders, KDS"
        disableSuffix
        description="Flaze is an all-in-one restaurant management platform built for Indian restaurants, cloud kitchens, QSRs and self-service counters. POS, kitchen display, online orders, UPI payments, multi-outlet analytics — set up in minutes."
        path="/"
      />
      <StructuredData
        data={buildFaqPage([
          {
            question: "What is Flaze?",
            answer:
              "Flaze is an all-in-one restaurant management platform with POS, online orders, kitchen display, payments and multi-outlet analytics — purpose-built for Indian restaurants, cloud kitchens, QSRs and self-service counters.",
          },
          {
            question: "Is there a free trial?",
            answer:
              "Yes. Every account gets a 7-day free trial with no credit card required. You only pay when you choose to continue, starting with a 3-month plan.",
          },
          {
            question: "Does Flaze work for cloud kitchens and QSRs?",
            answer:
              "Yes. Flaze automatically configures table-less workflows, self-service counters and delivery integrations for cloud kitchens, QSRs, food carts and other takeaway-first business types.",
          },
          {
            question: "Which payment methods are supported?",
            answer:
              "Flaze supports UPI, debit and credit cards, net-banking and cash. Online payments are powered by Razorpay; staff can also collect direct UPI / cash payments at the counter.",
          },
          {
            question: "Do I need any special hardware?",
            answer:
              "No special hardware is required. Flaze runs in any modern browser and on Android. We support common Bluetooth and LAN thermal printers when you want printed KOTs and bills.",
          },
        ])}
      />
      <Navbar />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden min-h-[calc(100svh-4rem)] flex items-center bg-black">
        {/* Looping video background — rotates between clips on each play-through */}
        <video
          key={videoIndex}
          autoPlay
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
          onEnded={() => setVideoIndex((i) => (i + 1) % heroVideos.length)}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
        >
          <source src={heroVideos[videoIndex]} type="video/mp4" />
        </video>
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/55 to-black/70" />
        <div className="container relative py-24 md:py-36">
          <div className="max-w-3xl space-y-8">
            {/* Typing tagline */}
            <p className="text-base md:text-lg text-white/70 font-medium tracking-wide">
              For all the Food Creators across the world!{" "}
              {/* Canonical brand name for crawlers and screen readers */}
              <span className="sr-only">Flaze!</span>
              {/* Decorative cycling text — hidden from accessibility tree */}
              <span className="text-primary font-bold" aria-hidden="true">
                {typedText}
                <span className="inline-block w-0.5 h-5 bg-primary ml-0.5 align-middle animate-pulse" />
              </span>
            </p>

            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight animate-slide-up text-white">
              Run your restaurant{" "}
              <span className="bg-gradient-to-r from-accent via-primary to-destructive bg-clip-text text-transparent">
                smarter.
              </span>
            </h1>

            <p className="text-lg md:text-xl text-white/80 max-w-2xl leading-relaxed">
              The all-in-one POS &amp; management platform built for Indian
              restaurants. Orders, kitchen, staff, and analytics — all in one
              beautiful app.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <Button
                size="lg"
                asChild
                className="gradient-warm text-white border-0 gap-2 h-12 px-8 text-base shadow-lg shadow-primary/25 hover:opacity-90 transition-opacity"
              >
                <Link to="/auth?mode=signup">
                  Start Free — No card needed
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="gap-2 h-12 px-8 text-base border-white/40 text-white bg-white/10 hover:bg-white/20 hover:text-white hover:border-white [&_svg]:text-current"
                onClick={() => setDownloadDialogOpen(true)}
              >
                <Download className="h-4 w-4" />
                Download our Android app
              </Button>
            </div>

            <p className="text-xs text-white/60">
              7-day free trial · No credit card required · Cancel anytime
            </p>
            <p className="text-xs text-white/70">Android APK available now — install directly on your device.</p>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="relative overflow-hidden bg-black text-white border-y border-white/10">
        <div className="absolute inset-0 landing-mesh opacity-80" />
        <div className="absolute inset-0 landing-grid-fade opacity-60" />
        <div className="container relative py-14 md:py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className={`text-center md:text-left px-2 ${
                  i < stats.length - 1 ? "md:border-r md:border-white/10" : ""
                }`}
              >
                <p className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-br from-accent via-primary to-destructive bg-clip-text text-transparent">
                  {stat.value}
                </p>
                <p className="text-sm text-white/55 mt-2 uppercase tracking-[0.18em]">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Platform Integrations ── */}
      <section className="py-14 overflow-hidden bg-[#0a0a0a] border-b border-white/5">
        <div className="container mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-[0.2em] mb-2">
              Integrations
            </p>
            <h2 className="text-xl md:text-2xl font-bold text-white">
              Plugs into the stack you already use
            </h2>
          </div>
          <p className="text-sm text-white/45 max-w-sm">
            Delivery, payments, maps — connected without spreadsheet gymnastics.
          </p>
        </div>
        <div className="relative flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
          <div
            ref={marqueeRef}
            className="flex gap-3 animate-[marquee_28s_linear_infinite] shrink-0"
          >
            {platforms.map((p, i) => (
              <div
                key={`${p}-${i}`}
                className="shrink-0 px-5 py-2.5 border border-white/10 bg-white/[0.03] text-sm font-medium text-white/70 hover:border-primary/50 hover:text-primary transition-colors whitespace-nowrap"
              >
                {p}
              </div>
            ))}
          </div>
          <div
            className="flex gap-3 animate-[marquee_28s_linear_infinite] shrink-0 ml-3"
            aria-hidden
          >
            {platforms.map((p, i) => (
              <div
                key={`${p}-dup-${i}`}
                className="shrink-0 px-5 py-2.5 border border-white/10 bg-white/[0.03] text-sm font-medium text-white/70 whitespace-nowrap"
              >
                {p}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="relative py-24 md:py-28 overflow-hidden">
        <div className="absolute top-0 right-0 w-[420px] h-[420px] bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[320px] h-[320px] bg-accent/10 blur-3xl pointer-events-none" />
        <div className="container relative">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
              <p className="text-xs font-semibold text-primary uppercase tracking-[0.2em]">
                Everything you need
              </p>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.1]">
                Powerful features,{" "}
                <span className="bg-gradient-to-r from-accent via-primary to-destructive bg-clip-text text-transparent">
                  zero complexity
                </span>
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Built by operators tired of clunky POS systems — so every screen
                earns its place on a busy service night.
              </p>
              <Button
                asChild
                className="gradient-warm text-white border-0 gap-2 hover:opacity-90"
              >
                <Link to="/auth?mode=signup">
                  Explore the product
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="lg:col-span-7 space-y-4">
              {/* Live dashboard mock — visual product anchor */}
              <div className="border border-border bg-black text-white overflow-hidden shadow-warm">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.03]">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 bg-destructive animate-pulse" />
                    <span className="text-xs font-medium text-white/70">Live outlets</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-widest text-primary">Today</span>
                </div>
                <div className="p-5 space-y-4">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs text-white/45 uppercase tracking-widest">Net sales</p>
                      <p className="text-3xl font-bold mt-1">₹73,800</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-accent font-medium">▲ 18% vs yesterday</p>
                      <p className="text-xs text-white/40 mt-1">142 orders · 3 outlets</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-2 h-20 items-end">
                    {[40, 65, 48, 80, 55, 92, 70].map((h, i) => (
                      <div
                        key={i}
                        className="w-full bg-gradient-to-t from-destructive/80 via-primary to-accent/90 opacity-90"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                  <div className="space-y-2 pt-1">
                    {[
                      { name: "Outlet A · Bandra", amt: "₹24,500", hot: true },
                      { name: "Outlet B · Andheri", amt: "₹18,200", hot: false },
                      { name: "Outlet C · Powai", amt: "₹31,100", hot: true },
                    ].map((row) => (
                      <div
                        key={row.name}
                        className="flex items-center justify-between text-sm border-t border-white/5 pt-2"
                      >
                        <span className="text-white/70 flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 ${row.hot ? "bg-primary" : "bg-white/30"}`} />
                          {row.name}
                        </span>
                        <span className="font-semibold tabular-nums">{row.amt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {features.slice(1).map((feature, i) => (
                  <div
                    key={feature.title}
                    className="landing-edge group border border-border bg-background/80 backdrop-blur-sm p-5 hover:bg-primary/[0.04] hover:border-primary/30 transition-all duration-300"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 shrink-0 flex items-center justify-center bg-gradient-to-br from-accent/20 via-primary/15 to-destructive/10 border border-primary/15 group-hover:from-accent/30 group-hover:via-primary/25 transition-colors">
                        <feature.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <h3 className="font-semibold text-sm leading-snug">{feature.title}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="relative py-24 md:py-28 bg-black text-white overflow-hidden">
        <div className="absolute inset-0 landing-mesh" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-gradient-to-b from-transparent via-primary/40 to-transparent hidden md:block" />
        <div className="container relative">
          <div className="max-w-2xl mb-14 md:mb-20">
            <p className="text-xs font-semibold text-primary uppercase tracking-[0.2em] mb-3">
              Simple onboarding
            </p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Up and running in{" "}
              <span className="text-primary">3 steps</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 md:gap-6">
            {steps.map((step, i) => (
              <div
                key={step.number}
                className="relative border border-white/10 bg-white/[0.03] p-6 md:p-8 hover:border-primary/40 transition-colors group"
              >
                <p className="text-6xl md:text-7xl font-bold leading-none mb-6 bg-gradient-to-br from-accent via-primary to-destructive bg-clip-text text-transparent opacity-90 group-hover:opacity-100 transition-opacity">
                  {step.number}
                </p>
                <div className="h-10 w-10 mb-4 flex items-center justify-center border border-primary/30 bg-primary/10">
                  <step.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-sm text-white/55 leading-relaxed">
                  {step.description}
                </p>
                {i < steps.length - 1 && (
                  <ArrowRight className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/50 z-10" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-24 md:py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/60 via-background to-background" />
        <div className="container relative">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
            <div className="space-y-3 max-w-xl">
              <p className="text-xs font-semibold text-primary uppercase tracking-[0.2em]">
                What restaurateurs say
              </p>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
                Loved by restaurant owners
              </h2>
            </div>
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-5 w-5 fill-accent text-accent" />
              ))}
              <span className="ml-2 text-sm text-muted-foreground">4.9 average</span>
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-4">
            {/* Featured quote */}
            <blockquote className="lg:col-span-7 border border-border bg-black text-white p-8 md:p-10 flex flex-col justify-between min-h-[280px]">
              <div>
                <div className="flex gap-0.5 mb-6">
                  {Array.from({ length: testimonials[0].stars }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-accent text-accent" />
                  ))}
                </div>
                <p className="text-xl md:text-2xl font-medium leading-relaxed text-white/90">
                  &ldquo;{testimonials[0].quote}&rdquo;
                </p>
              </div>
              <footer className="mt-8 pt-6 border-t border-white/10 flex items-center gap-3">
                <div className="h-11 w-11 flex items-center justify-center text-sm font-bold text-white gradient-warm">
                  {testimonials[0].initials}
                </div>
                <div>
                  <p className="font-semibold">{testimonials[0].name}</p>
                  <p className="text-sm text-white/50">
                    {testimonials[0].restaurant} · {testimonials[0].city}
                  </p>
                </div>
              </footer>
            </blockquote>

            <div className="lg:col-span-5 flex flex-col gap-4">
              {testimonials.slice(1).map((t) => (
                <blockquote
                  key={t.name}
                  className="flex-1 border border-border bg-background p-6 md:p-7 flex flex-col justify-between hover:border-primary/35 transition-colors"
                >
                  <div>
                    <div className="flex gap-0.5 mb-4">
                      {Array.from({ length: t.stars }).map((_, i) => (
                        <Star key={i} className="h-3.5 w-3.5 fill-accent text-accent" />
                      ))}
                    </div>
                    <p className="text-sm md:text-base text-foreground/80 leading-relaxed">
                      &ldquo;{t.quote}&rdquo;
                    </p>
                  </div>
                  <footer className="mt-6 pt-4 border-t border-border flex items-center gap-3">
                    <div className="h-9 w-9 flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br from-accent via-primary to-destructive">
                      {t.initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.restaurant}, {t.city}
                      </p>
                    </div>
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Why Flaze ── */}
      <section className="relative py-24 md:py-28 overflow-hidden border-y border-border">
        <div className="absolute inset-0 landing-mesh opacity-50" />
        <div className="container relative">
          <div className="grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">
            <div className="space-y-6">
              <p className="text-xs font-semibold text-primary uppercase tracking-[0.2em]">
                Why Flaze
              </p>
              <h2 className="text-4xl md:text-5xl font-bold leading-[1.1] tracking-tight">
                Built for Indian restaurants, by people who love food
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                We started Flaze after watching talented restaurant owners
                struggle with clunky, expensive POS systems that weren&apos;t built
                for how Indian restaurants actually operate. So we built
                something better.
              </p>
              <Button
                asChild
                className="gradient-warm text-white border-0 gap-2 hover:opacity-90 transition-opacity"
              >
                <Link to="/auth?mode=signup">
                  Get started free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-px bg-border border border-border">
              {whyItems.map((item) => (
                <div
                  key={item.label}
                  className="bg-background p-4 md:p-5 flex flex-col items-start gap-3 hover:bg-primary/[0.06] transition-colors group"
                >
                  <div className="h-9 w-9 flex items-center justify-center bg-gradient-to-br from-accent/25 via-primary/15 to-destructive/10 border border-primary/15 group-hover:border-primary/40 transition-colors">
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-xs md:text-sm font-medium leading-snug">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-16 md:py-20">
        <div className="container">
          <div className="relative overflow-hidden">
            <div className="gradient-warm absolute inset-0" />
            <div className="absolute inset-0 landing-grid-fade opacity-40" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.2),transparent_55%)]" />
            <div className="relative px-6 py-16 md:px-12 md:py-24 text-center space-y-6">
              <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight">
                Ready to transform your restaurant?
              </h2>
              <p className="text-white/85 max-w-xl mx-auto text-lg">
                Join 500+ restaurants already running smarter with Flaze.
                Start free — no credit card, no commitment.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
                <Button
                  size="lg"
                  asChild
                  className="bg-white text-primary hover:bg-white/90 gap-2 h-12 px-8 text-base font-semibold shadow-lg"
                >
                  <Link to="/auth?mode=signup">
                    Start your free trial
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <p className="text-white/65 text-xs">
                7-day free trial · No credit card required · Cancel anytime
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />

      <Dialog open={downloadDialogOpen} onOpenChange={setDownloadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Download Flaze Android App</DialogTitle>
            <DialogDescription>
              Share your email and contact number to get the latest APK instantly.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleDownloadApp}>
            <div className="space-y-2">
              <Label htmlFor="download-email">Email</Label>
              <Input
                id="download-email"
                type="email"
                value={downloadEmail}
                onChange={(e) => setDownloadEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="download-phone">Contact Number</Label>
              <Input
                id="download-phone"
                type="tel"
                value={downloadPhone}
                onChange={(e) => setDownloadPhone(e.target.value)}
                placeholder="+91 98765 43210"
                autoComplete="tel"
                required
              />
            </div>
            <Button type="submit" className="w-full gap-2" disabled={downloadSubmitting}>
              {downloadSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {downloadSubmitting ? "Preparing download..." : "Get APK"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Google Play listing is in progress — use the APK for early access.
            </p>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

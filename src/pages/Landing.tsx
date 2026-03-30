import { Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
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
} from "lucide-react";

// ─── Hero videos ─────────────────────────────────────────────────────────────

const heroVideos = [
  "/12996803_3840_2160_60fps.mp4",
  "/20671585-uhd_3840_2160_24fps.mp4",
  "/8448182-hd_1920_1080_24fps.mp4",
];

// ─── Typing words (Banaoo in multiple languages) ──────────────────────────────

const typingWords = [
  "Banaoo!",    // English
  "बनाओ!",      // Hindi
  "బనావో!",    // Telugu
  "பனாவோ!",   // Tamil
  "ബനാവോ!",   // Malayalam
  "ಬನಾವೋ!",   // Kannada
  "بنائو!",     // Urdu
  "Banaoo!",    // English again (loop smoothly)
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
      "banaoo.io cut our order errors by 80%. The kitchen display alone was worth the switch. Setup was genuinely 10 minutes.",
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
  const marqueeRef = useRef<HTMLDivElement>(null);
  const [videoIndex, setVideoIndex] = useState(0);

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

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden min-h-[92vh] flex items-center">
        {/* Looping video background */}
        <video
          key={videoIndex}
          autoPlay
          muted
          playsInline
          onEnded={() => setVideoIndex((i) => (i + 1) % heroVideos.length)}
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src={heroVideos[videoIndex]} type="video/mp4" />
        </video>
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-black/60" />
        <div className="container relative py-24 md:py-36">
          <div className="max-w-3xl space-y-8">
            {/* Typing tagline */}
            <p className="text-base md:text-lg text-white/70 font-medium tracking-wide">
              For all the Food Creators across the world!{" "}
              <span className="text-primary font-bold">
                {typedText}
                <span className="inline-block w-0.5 h-5 bg-primary ml-0.5 align-middle animate-pulse" />
              </span>
            </p>

            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight animate-slide-up text-white">
              Run your restaurant{" "}
              <span className="bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent">
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
                <Link to="/auth">
                  Start Free — No card needed
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <p className="text-xs text-white/60">
              7-day free trial · No credit card required · Cancel anytime
            </p>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <section className="border-y border-border bg-muted/40 py-8">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className={`text-center ${
                  i < stats.length - 1
                    ? "md:border-r md:border-border"
                    : ""
                }`}
              >
                <p className="text-3xl md:text-4xl font-bold text-primary">
                  {stat.value}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Platform Integrations ── */}
      <section className="py-16 overflow-hidden">
        <div className="container mb-8 text-center">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
            Works with your favourite platforms
          </p>
        </div>
        <div className="relative flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
          <div
            ref={marqueeRef}
            className="flex gap-6 animate-[marquee_30s_linear_infinite] shrink-0"
          >
            {platforms.map((p, i) => (
              <div
                key={`${p}-${i}`}
                className="shrink-0 px-6 py-3 rounded-full border border-border bg-background text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors whitespace-nowrap"
              >
                {p}
              </div>
            ))}
          </div>
          <div
            className="flex gap-6 animate-[marquee_30s_linear_infinite] shrink-0"
            aria-hidden
          >
            {platforms.map((p, i) => (
              <div
                key={`${p}-dup-${i}`}
                className="shrink-0 px-6 py-3 rounded-full border border-border bg-background text-sm font-medium text-muted-foreground whitespace-nowrap"
              >
                {p}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Bento Grid ── */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center space-y-4 mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
              Everything you need
            </div>
            <h2 className="text-3xl md:text-5xl font-bold">
              Powerful features,{" "}
              <span className="text-primary">zero complexity</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Built by restaurant operators who were tired of clunky,
              overcomplicated POS systems.
            </p>
          </div>

          {/* Bento: 1 large + 2 columns of smalls */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Large card */}
            <div className="lg:col-span-1 lg:row-span-2 rounded-2xl border border-border bg-background p-8 flex flex-col gap-6 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all group">
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary/20 to-orange-400/10 flex items-center justify-center group-hover:from-primary/30 transition-colors">
                <LayoutDashboard className="h-7 w-7 text-primary" />
              </div>
              <div className="space-y-3 flex-1">
                <h3 className="text-xl font-semibold">
                  Multi-Outlet Dashboard
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Control every location from a single screen — real-time
                  sales, staff activity, and live orders at a glance. Perfect
                  for growing chains and cloud kitchens.
                </p>
              </div>
              <div className="rounded-xl bg-muted/60 p-4 space-y-2">
                {["Outlet A — ₹24,500 today", "Outlet B — ₹18,200 today", "Outlet C — ₹31,100 today"].map(
                  (row) => (
                    <div
                      key={row}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <span className="h-2 w-2 rounded-full bg-primary/60 shrink-0" />
                      {row}
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Small cards — right 2 columns */}
            {features.slice(1).map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-border bg-background p-6 flex gap-4 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all group"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-sm">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-24">
        <div className="container">
          <div className="text-center space-y-4 mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
              Simple onboarding
            </div>
            <h2 className="text-3xl md:text-5xl font-bold">
              Up and running in{" "}
              <span className="text-primary">3 steps</span>
            </h2>
          </div>

          <div className="relative max-w-4xl mx-auto">
            {/* Connecting line — desktop */}
            <div className="hidden md:block absolute top-10 left-[calc(16.67%-1px)] right-[calc(16.67%-1px)] h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

            <div className="grid md:grid-cols-3 gap-10">
              {steps.map((step, i) => (
                <div key={step.number} className="relative text-center group">
                  <div className="flex justify-center mb-6">
                    <div className="relative">
                      <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 to-orange-400/10 border-2 border-primary/20 flex items-center justify-center group-hover:border-primary/50 transition-colors">
                        <step.icon className="h-8 w-8 text-primary" />
                      </div>
                      <span className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold mb-3">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center space-y-4 mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
              What restaurateurs say
            </div>
            <h2 className="text-3xl md:text-5xl font-bold">
              Loved by restaurant owners
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="rounded-2xl border border-border bg-background p-6 space-y-4 hover:border-primary/30 hover:shadow-md transition-all"
              >
                {/* Stars */}
                <div className="flex gap-0.5">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4 fill-amber-400 text-amber-400"
                    />
                  ))}
                </div>
                {/* Quote mark */}
                <p className="text-2xl text-primary/20 font-serif leading-none">
                  &ldquo;
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed -mt-4">
                  {t.quote}
                </p>
                {/* Author */}
                <div className="flex items-center gap-3 pt-2 border-t border-border">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-orange-400 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.restaurant}, {t.city}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why banaoo.io ── */}
      <section className="py-20">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                Why banaoo.io
              </div>
              <h2 className="text-3xl md:text-4xl font-bold leading-tight">
                Built for Indian restaurants, by people who love food
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We started banaoo.io after watching talented restaurant owners
                struggle with clunky, expensive POS systems that weren't built
                for how Indian restaurants actually operate. So we built
                something better.
              </p>
              <Button
                asChild
                className="gradient-warm text-white border-0 gap-2 hover:opacity-90 transition-opacity"
              >
                <Link to="/auth">
                  Get started free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {whyItems.map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-border bg-background p-4 flex flex-col items-center gap-2 text-center hover:border-primary/30 hover:bg-primary/5 transition-all group"
                >
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-xs font-medium leading-tight">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-24">
        <div className="container">
          <div className="relative rounded-3xl overflow-hidden">
            <div className="gradient-warm absolute inset-0 opacity-90" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
            <div className="relative px-8 py-16 md:py-24 text-center space-y-6">
              <h2 className="text-3xl md:text-5xl font-bold text-white">
                Ready to transform your restaurant?
              </h2>
              <p className="text-white/80 max-w-xl mx-auto text-lg">
                Join 500+ restaurants already running smarter with banaoo.io.
                Start free — no credit card, no commitment.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
                <Button
                  size="lg"
                  asChild
                  className="bg-white text-primary hover:bg-white/90 gap-2 h-12 px-8 text-base font-semibold shadow-lg"
                >
                  <Link to="/auth">
                    Start your free trial
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <p className="text-white/60 text-xs">
                7-day free trial · No credit card required · Cancel anytime
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

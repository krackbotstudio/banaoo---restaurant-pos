import { Link } from "react-router-dom";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Users,
  Share2,
  Wallet,
  TrendingUp,
  Clock,
  BarChart3,
  Gift,
  ArrowRight,
} from "lucide-react";
import { SEO, StructuredData, buildBreadcrumbList, buildFaqPage } from "@/components/seo/SEO";

export default function Affiliate() {
  const benefits = [
    {
      icon: TrendingUp,
      title: "10% Recurring Commission",
      description: "Earn 10% of every subscription payment your referrals make",
    },
    {
      icon: Clock,
      title: "Lifetime Earnings",
      description: "Keep earning as long as the restaurant stays subscribed",
    },
    {
      icon: Wallet,
      title: "Monthly Payouts",
      description: "Get your earnings transferred directly to your bank account",
    },
    {
      icon: BarChart3,
      title: "Real-time Tracking",
      description: "Monitor your referrals and earnings from your dashboard",
    },
    {
      icon: Gift,
      title: "Marketing Materials",
      description: "Access banners, content, and resources to help you promote",
    },
    {
      icon: Users,
      title: "Dedicated Support",
      description: "Get priority support from our affiliate success team",
    },
  ];

  const steps = [
    {
      number: "01",
      title: "Sign Up",
      description: "Apply to become a Banaoo affiliate. We'll review and approve within 48 hours.",
    },
    {
      number: "02",
      title: "Share Your Link",
      description: "Get your unique referral link and share it with restaurant owners.",
    },
    {
      number: "03",
      title: "Earn Forever",
      description: "Earn 10% commission on every subscription payment from your referrals.",
    },
  ];

  const faqs = [
    {
      question: "How much can I earn?",
      answer:
        "You earn 10% of every subscription payment your referrals make. For example, if a restaurant pays ₹699/month on Growth, you earn ₹69.90 every month they stay subscribed. There's no cap on earnings!",
    },
    {
      question: "When do I get paid?",
      answer:
        "Commissions are calculated at the end of each month and paid out by the 15th of the following month. Minimum payout threshold is ₹500.",
    },
    {
      question: "How do I track my referrals?",
      answer:
        "Once approved, you'll get access to an affiliate dashboard where you can see all your referrals, their subscription status, and your earnings in real-time.",
    },
    {
      question: "Can I refer existing Banaoo restaurants?",
      answer:
        "No, only new restaurant sign-ups through your referral link count. The referral must be their first time signing up for Banaoo.",
    },
    {
      question: "What happens if a restaurant cancels?",
      answer:
        "If a restaurant cancels their subscription, you stop earning commission for that referral. However, if they resubscribe later, you'll start earning again.",
    },
    {
      question: "Is there a limit to how many restaurants I can refer?",
      answer:
        "No limits! Refer as many restaurants as you can. More referrals = more earnings.",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        title="Affiliate Program — earn 10% recurring commission"
        description="Refer restaurants to banaoo and earn 10% recurring commission on every subscription. Real-time dashboard, lifetime tracking, monthly payouts."
        path="/affiliate"
      />
      <StructuredData
        data={buildBreadcrumbList([
          { name: "Home", path: "/" },
          { name: "Affiliate Program", path: "/affiliate" },
        ])}
      />
      <StructuredData data={buildFaqPage(faqs)} />
      <Navbar />

      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-b from-primary/5 to-background">
        <div className="container text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary mb-6">
            <Share2 className="h-4 w-4" />
            Affiliate Program
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            Earn 10% Forever by
            <span className="text-primary block">Referring Restaurants</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Join the Banaoo affiliate program and earn recurring commissions for every restaurant you bring to our platform. No limits, no caps.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to="/affiliate/auth">
                Become an Affiliate
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#how-it-works">Learn More</a>
            </Button>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Three simple steps to start earning
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                <div className="text-6xl font-bold text-primary/10 mb-4">{step.number}</div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 right-0 w-1/2 border-t-2 border-dashed border-primary/20" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Join Our Program?</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Everything you need to succeed as a Banaoo affiliate
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((benefit, index) => (
              <Card key={index} className="bg-background">
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <benefit.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{benefit.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Application Form */}
      <section id="apply" className="py-20">
        <div className="container">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Apply Now</h2>
              <p className="text-xl text-muted-foreground">Create your affiliate account and complete the application in the affiliate portal.</p>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Start Your Affiliate Application</CardTitle>
                <CardDescription>
                  Use the affiliate auth portal to sign up, sign in, and submit your profile for approval.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row gap-3">
                <Button asChild className="sm:flex-1">
                  <Link to="/affiliate/auth">Open Affiliate Portal</Link>
                </Button>
                <Button variant="outline" asChild className="sm:flex-1">
                  <Link to="/affiliate/auth">Sign In / Sign Up</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Frequently Asked Questions</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Everything you need to know about our affiliate program
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Start Earning?</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Join hundreds of affiliates already earning with Banaoo
          </p>
          <Button size="lg" asChild>
            <Link to="/affiliate/auth">Apply Now</Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
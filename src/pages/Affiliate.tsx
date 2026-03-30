import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Users,
  Share2,
  Wallet,
  TrendingUp,
  Clock,
  BarChart3,
  Gift,
  CheckCircle2,
  Loader2,
  ArrowRight,
} from "lucide-react";

interface AffiliateData {
  id: string;
  referral_code: string;
  status: string;
  created_at: string;
}

export default function Affiliate() {
  const { user, profile } = useAuth();
  const [affiliateData, setAffiliateData] = useState<AffiliateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    phone: "",
    upiId: "",
    bankName: "",
    accountNumber: "",
    ifscCode: "",
    reason: "",
  });

  useEffect(() => {
    if (user) {
      fetchAffiliateData();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchAffiliateData = async () => {
    try {
      const { data, error } = await supabase
        .from("affiliates")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) throw error;
      setAffiliateData(data);
    } catch (error) {
      console.error("Error fetching affiliate data:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateReferralCode = () => {
    const name = profile?.full_name?.split(" ")[0]?.toUpperCase() || "USER";
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${name}${random}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please log in to apply");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("affiliates").insert({
        user_id: user.id,
        referral_code: generateReferralCode(),
        payment_details: {
          phone: formData.phone,
          upi_id: formData.upiId,
          bank_name: formData.bankName,
          account_number: formData.accountNumber,
          ifsc_code: formData.ifscCode,
        },
        status: "pending",
      });

      if (error) throw error;

      toast.success("Application submitted! We'll review it within 48 hours.");
      await fetchAffiliateData();
    } catch (error: unknown) {
      console.error("Error submitting application:", error);
      const message = error instanceof Error ? error.message : "Failed to submit application";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const copyReferralLink = () => {
    if (affiliateData?.referral_code) {
      const link = `${window.location.origin}/auth?ref=${affiliateData.referral_code}`;
      navigator.clipboard.writeText(link);
      toast.success("Referral link copied!");
    }
  };

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
        "You earn 10% of every subscription payment your referrals make. For example, if a restaurant pays ₹999/month, you earn ₹99.90 every month they stay subscribed. There's no cap on earnings!",
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
              <a href="#apply">
                Become an Affiliate
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
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
              <p className="text-xl text-muted-foreground">
                {user
                  ? "Fill out the form below to join our affiliate program"
                  : "Log in to apply for the affiliate program"}
              </p>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !user ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground mb-4">
                    You need to be logged in to apply for the affiliate program.
                  </p>
                  <Button asChild>
                    <Link to="/auth">Log In to Apply</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : affiliateData ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        affiliateData.status === "approved"
                          ? "bg-green-100 text-green-600"
                          : affiliateData.status === "pending"
                          ? "bg-yellow-100 text-yellow-600"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle>Application {affiliateData.status === "approved" ? "Approved" : affiliateData.status === "pending" ? "Under Review" : "Status"}</CardTitle>
                      <CardDescription>
                        {affiliateData.status === "approved"
                          ? "You're now a Banaoo affiliate!"
                          : affiliateData.status === "pending"
                          ? "We'll review your application within 48 hours"
                          : `Status: ${affiliateData.status}`}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                {affiliateData.status === "approved" && (
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Your Referral Code</Label>
                      <p className="text-2xl font-mono font-bold text-primary">
                        {affiliateData.referral_code}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Your Referral Link</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          readOnly
                          value={`${window.location.origin}/auth?ref=${affiliateData.referral_code}`}
                          className="font-mono text-sm"
                        />
                        <Button onClick={copyReferralLink}>Copy</Button>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Affiliate Application</CardTitle>
                  <CardDescription>
                    Complete the form below to apply for our affiliate program
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid gap-4">
                      <div>
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                          id="name"
                          value={profile?.full_name || ""}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone Number *</Label>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="+91 98765 43210"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium">Payment Details</h4>
                      <div>
                        <Label htmlFor="upiId">UPI ID (Preferred)</Label>
                        <Input
                          id="upiId"
                          placeholder="yourname@upi"
                          value={formData.upiId}
                          onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground text-center">— OR —</p>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                          <Label htmlFor="bankName">Bank Name</Label>
                          <Input
                            id="bankName"
                            placeholder="HDFC Bank"
                            value={formData.bankName}
                            onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="accountNumber">Account Number</Label>
                          <Input
                            id="accountNumber"
                            placeholder="1234567890"
                            value={formData.accountNumber}
                            onChange={(e) =>
                              setFormData({ ...formData, accountNumber: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="ifscCode">IFSC Code</Label>
                          <Input
                            id="ifscCode"
                            placeholder="HDFC0001234"
                            value={formData.ifscCode}
                            onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="reason">Why do you want to join? (Optional)</Label>
                      <Textarea
                        id="reason"
                        placeholder="Tell us about your network and how you plan to promote Banaoo..."
                        value={formData.reason}
                        onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                        rows={3}
                      />
                    </div>

                    <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        "Submit Application"
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
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
            <a href="#apply">Apply Now</a>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { PricingComparison } from "@/components/landing/PricingComparison";
import { SEO } from "@/components/seo/SEO";

export default function Pricing() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hidden from public navigation today; in-app FeatureGate still routes here. Noindex prevents Google from showing it in SERPs while we figure out the public pricing story. */}
      <SEO
        title="Plans & Pricing"
        description="Compare Flaze plans — Starter, Pro and Enterprise. Transparent pricing, 7-day free trial, no credit card required."
        path="/pricing"
        noindex
      />
      <Navbar />
      <main className="flex-1 py-16 md:py-24">
        <div className="container">
          <PricingComparison />
        </div>
      </main>
      <Footer />
    </div>
  );
}

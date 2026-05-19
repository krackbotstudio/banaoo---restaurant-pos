import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { PricingComparison } from "@/components/landing/PricingComparison";

export default function Pricing() {
  return (
    <div className="min-h-screen flex flex-col">
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

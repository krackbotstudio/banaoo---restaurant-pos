import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { SEO, StructuredData, buildBreadcrumbList } from "@/components/seo/SEO";

export default function Shipping() {
  const updated = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        title="Shipping & Delivery Policy"
        description="Service delivery and access policy for Flaze's restaurant management platform — how subscriptions are activated and supported."
        path="/shipping"
      />
      <StructuredData
        data={buildBreadcrumbList([
          { name: "Home", path: "/" },
          { name: "Shipping & Delivery", path: "/shipping" },
        ])}
      />
      <Navbar />

      <main className="flex-1 py-12 md:py-20">
        <div className="container max-w-3xl">
          <div className="mb-10">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Shipping &amp; Delivery Policy</h1>
            <p className="text-sm text-muted-foreground">Last updated: {updated}</p>
          </div>

          <div className="space-y-10 text-sm leading-relaxed">
            {/* Important callout */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
              <p className="text-sm text-foreground font-medium">
                Flaze is a 100% cloud-based software platform.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                There are no physical products shipped as part of your subscription. Access to the platform
                is delivered instantly and digitally.
              </p>
            </div>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">1. Digital Service Delivery</h2>
              <p className="text-muted-foreground">
                Flaze is a Software-as-a-Service (SaaS) product. Upon completing registration and
                (where applicable) subscribing to a paid plan, you receive immediate access to the platform
                through your web browser on any device — no downloads, no hardware required, no waiting.
              </p>
              <p className="text-muted-foreground">
                A welcome email with your account details and getting-started guide is sent to your
                registered email address within minutes of sign-up.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">2. Account Activation</h2>
              <p className="text-muted-foreground">
                Your account is activated instantly upon registration. If you signed up using an email
                address that requires verification, you will receive a confirmation link. Click the link to
                activate your account. If you do not receive the email within 5 minutes, check your spam
                folder or contact us at{" "}
                <a href="mailto:connect@flazee.com" className="text-primary underline underline-offset-2">
                  connect@flazee.com
                </a>
                .
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">3. Service Availability</h2>
              <p className="text-muted-foreground">
                The Flaze platform is accessible 24/7 from anywhere with an internet connection. We
                target 99.9% monthly uptime. Planned maintenance windows are communicated in advance via
                email and in-app notifications, and are typically scheduled between 2:00 AM – 5:00 AM IST
                to minimise disruption.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">4. No Physical Shipping</h2>
              <p className="text-muted-foreground">
                Flaze does not sell, ship, or deliver physical hardware, printers, tablets, or
                accessories directly. Our platform is designed to work with your existing devices (phones,
                tablets, laptops, desktops) without requiring any proprietary hardware.
              </p>
              <p className="text-muted-foreground">
                If you require hardware recommendations (receipt printers, KDS screens, tablets) that are
                compatible with Flaze, our support team can guide you to partner vendors. Those
                purchases would be made directly with the respective vendor and governed by their
                shipping/returns policies.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">5. Data Export Delivery</h2>
              <p className="text-muted-foreground">
                When you request a data export (e.g., on account cancellation or for your own records), we
                will prepare and deliver the export file to your registered email address within{" "}
                <strong className="text-foreground">3 business days</strong>. Data is exported in common
                formats (CSV/Excel) for easy use.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">6. Invoices &amp; Receipts</h2>
              <p className="text-muted-foreground">
                GST-compliant invoices for your subscription payments are generated automatically and
                delivered to your registered email address within 24 hours of each successful payment.
                You can also download all invoices from{" "}
                <strong className="text-foreground">Settings → Billing</strong> in your dashboard at any time.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">7. Contact Us</h2>
              <p className="text-muted-foreground">
                For any questions about accessing the platform or receiving your digital deliverables:
              </p>
              <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Flaze Support</p>
                <p>
                  Email:{" "}
                  <a href="mailto:connect@flazee.com" className="text-primary underline underline-offset-2">
                    connect@flazee.com
                  </a>
                </p>
                <p>Support hours: Mon–Sat, 9:00 AM – 6:00 PM IST</p>
              </div>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

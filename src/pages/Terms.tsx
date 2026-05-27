import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { SEO, StructuredData, buildBreadcrumbList } from "@/components/seo/SEO";

export default function Terms() {
  const updated = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        title="Terms & Conditions"
        description="Read the banaoo Terms and Conditions covering subscriptions, billing, acceptable use, intellectual property and data ownership."
        path="/terms"
      />
      <StructuredData
        data={buildBreadcrumbList([
          { name: "Home", path: "/" },
          { name: "Terms & Conditions", path: "/terms" },
        ])}
      />
      <Navbar />

      <main className="flex-1 py-12 md:py-20">
        <div className="container max-w-3xl">
          <div className="mb-10">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Terms and Conditions</h1>
            <p className="text-sm text-muted-foreground">Last updated: {updated}</p>
          </div>

          <div className="space-y-10 text-sm leading-relaxed">
            <p className="text-muted-foreground text-base">
              Please read these Terms and Conditions carefully before using banaoo.io. By accessing or using
              our platform, you agree to be bound by these terms. If you do not agree, you may not use our
              services.
            </p>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                These Terms constitute a legally binding agreement between you ("Restaurant Owner," "User," or
                "you") and banaoo.io ("we," "us," or "our"). By creating an account, subscribing to a plan, or
                using any part of our platform, you accept these Terms in full.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">2. Description of Service</h2>
              <p className="text-muted-foreground">
                banaoo.io provides a cloud-based point-of-sale (POS) and restaurant management platform,
                including but not limited to: order management, kitchen display system, menu management,
                staff management, multi-outlet dashboards, customer analytics, and integrations with
                third-party delivery and payment platforms.
              </p>
              <p className="text-muted-foreground">
                We reserve the right to modify, suspend, or discontinue any feature with reasonable notice.
                We will not be liable for any modification, suspension, or discontinuation of the service.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">3. Account Registration</h2>
              <p className="text-muted-foreground">
                You must provide accurate, current, and complete information when creating your account. You
                are responsible for maintaining the confidentiality of your login credentials and for all
                activities conducted under your account. You must notify us immediately at{" "}
                <a href="mailto:connect@banaoo.in" className="text-primary underline underline-offset-2">
                  connect@banaoo.in
                </a>{" "}
                if you suspect any unauthorised access.
              </p>
              <p className="text-muted-foreground">
                One account per business entity is permitted unless you are managing multiple outlets through
                our multi-outlet feature. Each account holder must be at least 18 years of age.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">4. Subscription and Payment</h2>
              <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                <li>
                  Subscription fees are charged in advance for 3, 6, or 12 months, depending on the term you
                  choose.
                </li>
                <li>
                  All prices are listed in Indian Rupees (INR) and are exclusive of applicable GST unless
                  stated otherwise.
                </li>
                <li>
                  We use Razorpay as our payment processor. By subscribing, you authorise us to charge your
                  chosen payment method on a recurring basis.
                </li>
                <li>
                  Failed payments may result in service suspension. We will attempt to notify you before
                  suspending access.
                </li>
                <li>
                  We reserve the right to change pricing with at least 30 days' prior notice via email.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">5. Free Trial</h2>
              <p className="text-muted-foreground">
                New accounts receive a 7-day free trial. No payment information is required during the trial.
                At the end of the trial, you must subscribe to a paid plan to continue using the service.
                Data entered during the trial is preserved when you upgrade.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">6. Acceptable Use</h2>
              <p className="text-muted-foreground">You agree not to:</p>
              <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                <li>Use the platform for any unlawful purpose or in violation of any applicable law.</li>
                <li>
                  Attempt to gain unauthorised access to any part of our system or another user's account.
                </li>
                <li>
                  Reverse-engineer, decompile, or attempt to extract the source code of the platform.
                </li>
                <li>
                  Use automated tools (bots, scrapers) to access or interact with the platform without prior
                  written consent.
                </li>
                <li>Resell or sublicense access to the platform to any third party.</li>
                <li>Upload content that is defamatory, fraudulent, or infringes on third-party rights.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">7. Your Data</h2>
              <p className="text-muted-foreground">
                You own the data you enter into banaoo.io (menus, orders, customer records, etc.). By using
                the platform, you grant us a limited licence to store, process, and display that data solely
                to provide the service. We will never sell your restaurant data to third parties. For full
                details, see our{" "}
                <a href="/privacy" className="text-primary underline underline-offset-2">
                  Privacy Policy
                </a>
                .
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">8. Intellectual Property</h2>
              <p className="text-muted-foreground">
                All platform software, design, branding, and content (excluding your data) is owned by
                banaoo.io and protected under applicable copyright, trademark, and intellectual property laws.
                You may not copy, modify, distribute, or create derivative works without our express written
                permission.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">9. Third-Party Integrations</h2>
              <p className="text-muted-foreground">
                banaoo.io integrates with third-party services (Zomato, Swiggy, Razorpay, WhatsApp, etc.).
                These integrations are subject to the respective third party's terms of service. We are not
                responsible for the availability, accuracy, or actions of these third-party services.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">10. Service Availability &amp; Uptime</h2>
              <p className="text-muted-foreground">
                We aim for 99.9% monthly uptime. Planned maintenance will be scheduled during off-peak hours
                with advance notice. We are not responsible for downtime caused by factors outside our
                control (internet outages, third-party failures, force majeure events).
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">11. Limitation of Liability</h2>
              <p className="text-muted-foreground">
                To the maximum extent permitted by law, banaoo.io shall not be liable for any indirect,
                incidental, special, consequential, or punitive damages, including but not limited to loss of
                revenue, loss of data, or business interruption arising from your use of the service.
              </p>
              <p className="text-muted-foreground">
                Our total aggregate liability in any 12-month period shall not exceed the subscription fees
                you paid to us during that same period.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">12. Termination</h2>
              <p className="text-muted-foreground">
                You may cancel your subscription at any time from your account settings. We may suspend or
                terminate your account with notice if you violate these Terms, fail to pay, or engage in
                behaviour that harms other users or the platform. Upon termination, your right to access the
                platform ceases immediately, though we will provide a 30-day data export window.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">13. Governing Law &amp; Disputes</h2>
              <p className="text-muted-foreground">
                These Terms are governed by the laws of India. Any disputes arising from or relating to these
                Terms shall be resolved through arbitration under the Arbitration and Conciliation Act, 1996,
                with the seat of arbitration in Bengaluru, Karnataka, India.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">14. Changes to These Terms</h2>
              <p className="text-muted-foreground">
                We may revise these Terms at any time. We will notify you of significant changes via email at
                least 14 days before the changes take effect. Your continued use of banaoo.io constitutes
                acceptance of the revised Terms.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">15. Contact Us</h2>
              <p className="text-muted-foreground">
                If you have questions about these Terms, please contact us:
              </p>
              <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">banaoo.io</p>
                <p>
                  Email:{" "}
                  <a href="mailto:connect@banaoo.in" className="text-primary underline underline-offset-2">
                    connect@banaoo.in
                  </a>
                </p>
                <p>Jurisdiction: Bengaluru, Karnataka, India</p>
              </div>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

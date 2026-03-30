import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export default function Privacy() {
  const updated = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 py-12 md:py-20">
        <div className="container max-w-3xl">
          <div className="mb-10">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground">Last updated: {updated}</p>
          </div>

          <div className="space-y-10 text-sm leading-relaxed">
            <p className="text-muted-foreground text-base">
              At banaoo.io, we take your privacy seriously. This policy explains what data we collect, why we
              collect it, how it's used, and your rights over it. By using banaoo.io you agree to the practices
              described here.
            </p>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">1. Information We Collect</h2>
              <p className="text-muted-foreground">
                <strong className="text-foreground">Information you provide directly:</strong> When you create an
                account or use our services, we collect your full name, email address, phone number, restaurant
                name, business address, and payment/billing information.
              </p>
              <p className="text-muted-foreground">
                <strong className="text-foreground">Information from your use of the service:</strong> We
                automatically collect usage data including pages visited, features used, session duration, order
                and transaction data entered into the platform, device type, browser version, and IP address.
              </p>
              <p className="text-muted-foreground">
                <strong className="text-foreground">Cookies and trackers:</strong> We use first-party cookies to
                keep you logged in and remember your preferences. We also use analytics cookies (see Section 7)
                to understand how the product is used.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">2. How We Use Your Information</h2>
              <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                <li>Provide, maintain, and improve the banaoo.io platform and its features.</li>
                <li>Process your subscription payments and send receipts and billing notifications.</li>
                <li>Send transactional emails (account confirmation, password reset, subscription reminders).</li>
                <li>
                  Send product updates and promotional communications (you can opt out at any time).
                </li>
                <li>Provide customer support and respond to your queries.</li>
                <li>Detect, investigate, and prevent fraudulent or illegal activity.</li>
                <li>Comply with applicable legal obligations under Indian law.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">3. Third-Party Services We Use</h2>
              <p className="text-muted-foreground">
                We work with trusted third parties to operate banaoo.io:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                <li>
                  <strong className="text-foreground">Supabase</strong> — our database and authentication
                  provider. Your data is stored securely in their infrastructure.
                </li>
                <li>
                  <strong className="text-foreground">Razorpay</strong> — payment processing. We do not store
                  your full card details; Razorpay handles payment data under PCI-DSS compliance.
                </li>
                <li>
                  <strong className="text-foreground">Analytics tools</strong> — anonymised usage data to
                  improve the product. No personally identifiable data is shared with analytics providers.
                </li>
              </ul>
              <p className="text-muted-foreground">
                We do not sell your personal information to any third party.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">4. Data Retention</h2>
              <p className="text-muted-foreground">
                We retain your account data for as long as your account is active. If you delete your account,
                we will permanently delete your personal information within 30 days, except where we are
                required to retain it for legal, tax, or compliance purposes (typically up to 7 years under
                Indian GST law for billing records).
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">5. Data Security</h2>
              <p className="text-muted-foreground">
                We implement industry-standard security measures including AES-256 encryption at rest, TLS
                encryption in transit, role-based access controls, and regular security audits. While no system
                is 100% secure, we are committed to protecting your data with best practices.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">6. Your Rights</h2>
              <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                <li>
                  <strong className="text-foreground">Access</strong> — request a copy of the personal data we
                  hold about you.
                </li>
                <li>
                  <strong className="text-foreground">Correct</strong> — update inaccurate or incomplete
                  information from your account settings.
                </li>
                <li>
                  <strong className="text-foreground">Delete</strong> — request deletion of your account and
                  associated data.
                </li>
                <li>
                  <strong className="text-foreground">Opt out of marketing</strong> — unsubscribe from
                  promotional emails at any time using the link in any email we send.
                </li>
                <li>
                  <strong className="text-foreground">Data portability</strong> — request an export of your
                  restaurant data in a common format.
                </li>
              </ul>
              <p className="text-muted-foreground">
                To exercise any of these rights, email us at{" "}
                <a href="mailto:connect@banaoo.in" className="text-primary underline underline-offset-2">
                  connect@banaoo.in
                </a>
                .
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">7. Cookies &amp; Tracking</h2>
              <p className="text-muted-foreground">
                We use cookies for authentication (keeping you logged in), preference storage, and anonymous
                analytics. You can decline non-essential cookies using the cookie consent banner shown on your
                first visit. You can also manage cookies through your browser settings, though disabling
                certain cookies may affect platform functionality.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">8. Children's Privacy</h2>
              <p className="text-muted-foreground">
                banaoo.io is a B2B platform intended for business owners and operators aged 18 and above. We
                do not knowingly collect personal data from anyone under 18. If we become aware that we have
                done so, we will delete that data immediately.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">9. Changes to This Policy</h2>
              <p className="text-muted-foreground">
                We may update this Privacy Policy from time to time. We will notify you of material changes by
                email or through an in-app notice at least 14 days before the changes take effect. Your
                continued use of banaoo.io after the effective date constitutes acceptance of the updated
                policy.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">10. Contact Us</h2>
              <p className="text-muted-foreground">
                For any privacy-related questions, requests, or concerns, please contact:
              </p>
              <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">banaoo.io</p>
                <p>
                  Email:{" "}
                  <a href="mailto:connect@banaoo.in" className="text-primary underline underline-offset-2">
                    connect@banaoo.in
                  </a>
                </p>
                <p>Governing law: India (Information Technology Act, 2000)</p>
              </div>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

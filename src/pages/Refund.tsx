import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export default function Refund() {
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
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Refund &amp; Cancellation Policy</h1>
            <p className="text-sm text-muted-foreground">Last updated: {updated}</p>
          </div>

          <div className="space-y-10 text-sm leading-relaxed">
            <p className="text-muted-foreground text-base">
              We want you to be completely satisfied with banaoo.io. This policy explains your options if
              you are not happy with your subscription.
            </p>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">1. Free Trial</h2>
              <p className="text-muted-foreground">
                All new accounts receive a <strong className="text-foreground">7-day free trial</strong> with
                full access to all features. No credit card is required during the trial. You can explore the
                platform risk-free and cancel at any point before the trial ends without being charged.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">2. 3-Month Subscription Refunds</h2>
              <p className="text-muted-foreground">
                If you are on a 3-month plan and are not satisfied, you may request a full refund within{" "}
                <strong className="text-foreground">7 days of your first paid charge</strong>. After 7 days,
                no refunds will be issued for the current billing period. Your access will continue until the
                end of the paid period.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">3. 6- and 12-Month Subscription Refunds</h2>
              <p className="text-muted-foreground">
                For 6- and 12-month plans, we offer a <strong className="text-foreground">prorated refund</strong> for
                unused complete months if you cancel within the first{" "}
                <strong className="text-foreground">30 days</strong> of your subscription term. After 30
                days, no refunds will be issued for those plans. The refund will be calculated as:
              </p>
              <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                <p className="font-mono">
                  Refund = (Annual fee ÷ 12) × remaining complete months
                </p>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">4. How to Request a Refund</h2>
              <p className="text-muted-foreground">To request a refund:</p>
              <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
                <li>
                  Email us at{" "}
                  <a href="mailto:connect@banaoo.in" className="text-primary underline underline-offset-2">
                    connect@banaoo.in
                  </a>{" "}
                  with the subject line "Refund Request."
                </li>
                <li>Include your registered email address and the reason for your request.</li>
                <li>
                  We will review your request and respond within{" "}
                  <strong className="text-foreground">2 business days</strong>.
                </li>
                <li>
                  Approved refunds will be credited to your original payment method within{" "}
                  <strong className="text-foreground">5–7 business days</strong>, depending on your bank.
                </li>
              </ol>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">5. Non-Refundable Items</h2>
              <p className="text-muted-foreground">The following are not eligible for refunds:</p>
              <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                <li>
                  Charges after the 7-day (3-month) or 30-day (6- and 12-month) refund window has passed.
                </li>
                <li>
                  Add-on services, custom integrations, or one-time setup fees already rendered.
                </li>
                <li>Subscription fees for accounts suspended due to Terms of Service violations.</li>
                <li>
                  Partial months — we do not issue prorated refunds for mid-cycle cancellations on 3-month
                  plans.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">6. Cancellation</h2>
              <p className="text-muted-foreground">
                You can cancel your subscription at any time from{" "}
                <strong className="text-foreground">Settings → Subscription</strong> in your dashboard.
                Cancellation takes effect at the end of your current billing cycle. You will retain full
                access until that date. After cancellation:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                <li>Your data is retained for 30 days, during which you can request an export.</li>
                <li>After 30 days, your data is permanently deleted from our servers.</li>
                <li>You can reactivate your account within the 30-day window without losing data.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">7. Plan Downgrades</h2>
              <p className="text-muted-foreground">
                If you downgrade to a lower-tier plan, the new pricing takes effect at the start of your
                next billing cycle. No refunds or credits are issued for the remaining time on your current
                higher-tier plan.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">8. Billing Disputes</h2>
              <p className="text-muted-foreground">
                If you believe you have been charged incorrectly, please contact us within{" "}
                <strong className="text-foreground">30 days of the charge</strong> at{" "}
                <a href="mailto:connect@banaoo.in" className="text-primary underline underline-offset-2">
                  connect@banaoo.in
                </a>
                . We will investigate promptly and issue a correction or refund if the charge was in error.
                Please do not file a chargeback without contacting us first — we will resolve legitimate
                disputes quickly.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">9. Contact Us</h2>
              <p className="text-muted-foreground">
                For any questions about this policy or to initiate a refund:
              </p>
              <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">banaoo.io Support</p>
                <p>
                  Email:{" "}
                  <a href="mailto:connect@banaoo.in" className="text-primary underline underline-offset-2">
                    connect@banaoo.in
                  </a>
                </p>
                <p>Response time: within 2 business days</p>
              </div>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

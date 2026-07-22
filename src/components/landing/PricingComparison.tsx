import { Link } from "react-router-dom";
import { Check, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  PLANS,
  COMPARISON_ROWS,
  formatPlanPrice,
  type FeatureCell,
  type PlanDefinition,
  type PlanId,
} from "@/lib/plans";
import { cn } from "@/lib/utils";

function FeatureValue({ cell }: { cell: FeatureCell }) {
  if (cell.kind === "check") {
    return <Check className="h-4 w-4 text-primary mx-auto" aria-label="Included" />;
  }
  if (cell.kind === "dash") {
    return <Minus className="h-4 w-4 text-muted-foreground/50 mx-auto" aria-label="Not included" />;
  }
  if (cell.kind === "addon") {
    return <span className="text-xs font-medium text-accent">Add-on</span>;
  }
  return <span className="text-xs font-medium text-foreground">{cell.value}</span>;
}

function PlanCta({ plan }: { plan: PlanDefinition }) {
  const { user } = useAuth();

  if (plan.ctaAction === "mailto") {
    const subject = encodeURIComponent(plan.mailtoSubject ?? "Expand Plan Enquiry");
    return (
      <Button variant="outline" className="w-full" asChild>
        <a href={`mailto:connect@flazee.com?subject=${subject}`}>{plan.ctaLabel}</a>
      </Button>
    );
  }

  const href = user ? "/settings?tab=subscription" : "/auth";
  const isGrowth = plan.id === "professional";

  return (
    <Button
      className={cn("w-full", isGrowth && "gradient-primary glow-primary")}
      variant={isGrowth ? "default" : "outline"}
      asChild
    >
      <Link to={href}>{plan.ctaLabel}</Link>
    </Button>
  );
}

function MobileFeatureRow({
  label,
  cell,
  muted,
}: {
  label: string;
  cell: FeatureCell;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 py-1 border-b border-border/50 last:border-0",
        muted && "text-muted-foreground"
      )}
    >
      <span className="text-muted-foreground text-xs">{label}</span>
      <FeatureValue cell={cell} />
    </div>
  );
}

function MobilePlanCard({ plan }: { plan: PlanDefinition }) {
  const featureRows = COMPARISON_ROWS.filter((r) => !r.isPricingRow);
  const addonRows = COMPARISON_ROWS.filter((r) => r.isPricingRow && r.label !== "Pricing");

  return (
    <div
      className={cn(
        "rounded-2xl border bg-background p-5 flex flex-col gap-4",
        plan.mostPopular && "border-primary border-2 shadow-md ring-1 ring-primary/20"
      )}
    >
      {plan.mostPopular && (
        <span className="self-center bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full -mt-1">
          Most Popular
        </span>
      )}
      <div>
        <h3 className="text-lg font-bold">{plan.displayName}</h3>
        <p className="text-2xl font-bold text-primary">{formatPlanPrice(plan)}</p>
        <p className="text-sm text-muted-foreground">{plan.tagline}</p>
      </div>
      <div className="space-y-0">
        {featureRows.map((row) => (
          <MobileFeatureRow key={row.label} label={row.label} cell={row[plan.id as PlanId]} />
        ))}
        {addonRows.length > 0 && (
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground pt-2 pb-1">Add-ons</p>
        )}
        {addonRows.map((row) => (
          <MobileFeatureRow key={row.label} label={row.label} cell={row[plan.id as PlanId]} muted />
        ))}
      </div>
      <PlanCta plan={plan} />
    </div>
  );
}

const PLAN_COLUMN_IDS: PlanId[] = ["starter", "professional", "enterprise"];

export function PricingComparison({ showHeader = true }: { showHeader?: boolean }) {
  return (
    <div className="space-y-10">
      {showHeader && (
        <div className="text-center space-y-4">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
            Simple, transparent pricing
          </span>
          <h2 className="text-3xl md:text-5xl font-bold">Plans that grow with your restaurant</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Start with Launcher, upgrade to Growth for the mobile app, or talk to us for Expand.
          </p>
        </div>
      )}

      <div className="grid gap-6 md:hidden">
        {PLANS.map((plan) => (
          <MobilePlanCard key={plan.id} plan={plan} />
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto rounded-2xl border border-border bg-background shadow-sm">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-4 font-medium text-muted-foreground w-[28%]">Features</th>
              {PLANS.map((plan) => (
                <th
                  key={plan.id}
                  className={cn("p-4 text-center align-top w-[24%]", plan.mostPopular && "bg-primary/5")}
                >
                  <div className="space-y-1">
                    {plan.mostPopular && (
                      <span className="inline-block bg-primary text-primary-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full mb-1">
                        Most Popular
                      </span>
                    )}
                    <p className="text-lg font-bold">{plan.displayName}</p>
                    <p className="text-primary font-semibold">{formatPlanPrice(plan)}</p>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((row, idx) => (
              <tr
                key={row.label}
                className={cn(
                  "border-b border-border/60",
                  row.isPricingRow && "bg-muted/30",
                  idx === COMPARISON_ROWS.length - 1 && "border-b-0"
                )}
              >
                <td className="p-3 pl-4 font-medium text-foreground">{row.label}</td>
                {PLAN_COLUMN_IDS.map((planId) => {
                  const plan = PLANS.find((p) => p.id === planId)!;
                  return (
                    <td
                      key={planId}
                      className={cn("p-3 text-center", plan.mostPopular && "bg-primary/5")}
                    >
                      <FeatureValue cell={row[planId]} />
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td className="p-4" />
              {PLANS.map((plan) => (
                <td key={plan.id} className={cn("p-4 pt-2", plan.mostPopular && "bg-primary/5")}>
                  <PlanCta plan={plan} />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Additional outlets (₹250/month) and extra staff (₹150/month) available on Launcher and Growth — purchase from Settings → Add-ons after subscribing.
      </p>
    </div>
  );
}

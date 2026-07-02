import { Globe } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FeatureGate } from "@/components/FeatureGate";
import { OrderingLinkRow } from "@/components/customer/OrderingLinkRow";

interface BrandOrderingLinkCardProps {
  brandName?: string | null;
  orderingSlug?: string | null;
}

export function BrandOrderingLinkCard({ brandName, orderingSlug }: BrandOrderingLinkCardProps) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const brandUrl = orderingSlug ? `${origin}/order/${orderingSlug}` : null;
  const displayBrand = brandName || "Your restaurant";

  return (
    <FeatureGate feature="customerOrdering" showUpgradePrompt>
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.06] via-background to-accent/[0.04]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="p-2 rounded-lg bg-primary/10">
              <Globe className="h-4 w-4 text-primary" />
            </div>
            Brand ordering page
          </CardTitle>
          <CardDescription>
            One link for all outlets — customers see the nearest location first when GPS is set on each
            outlet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {brandUrl ? (
            <div className="space-y-3">
              <Badge className="bg-green-500/15 text-green-700 border-green-500/25">Recommended</Badge>
              <OrderingLinkRow
                label="Brand link"
                url={brandUrl}
                openPath={`/order/${orderingSlug}`}
                restaurantName={displayBrand}
                showQr
              />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-muted-foreground/30 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              Complete onboarding to get your brand ordering slug, or contact support if it is missing.
            </div>
          )}
        </CardContent>
      </Card>
    </FeatureGate>
  );
}

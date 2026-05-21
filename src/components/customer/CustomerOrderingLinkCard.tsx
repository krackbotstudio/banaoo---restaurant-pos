import { Link2, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FeatureGate } from "@/components/FeatureGate";
import { OrderingLinkRow } from "@/components/customer/OrderingLinkRow";

export interface CustomerOrderingLinkCardProps {
  outletId: string;
  outletName: string;
  brandName?: string | null;
  orderingSlug?: string | null;
  /** When false, show GPS reminder with optional manage link */
  hasGpsLocation?: boolean;
  manageHref?: string;
}

export function CustomerOrderingLinkCard({
  outletId,
  outletName,
  brandName,
  orderingSlug,
  hasGpsLocation = true,
  manageHref,
}: CustomerOrderingLinkCardProps) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const directUrl = `${origin}/r/${outletId}`;
  const brandUrl = orderingSlug ? `${origin}/order/${orderingSlug}` : null;
  const displayBrand = brandName || outletName;

  return (
    <FeatureGate feature="customerOrdering" showUpgradePrompt>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            Customer Ordering Link
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Share these links with customers so they can order online from their phones.
          </p>

          {brandUrl && (
            <OrderingLinkRow
              label="Brand ordering page"
              hint="Shows all outlets with GPS distance"
              url={brandUrl}
              openPath={`/order/${orderingSlug}`}
              restaurantName={displayBrand}
              showQr
            />
          )}

          <OrderingLinkRow
            label="Direct outlet link"
            hint="Goes straight to this outlet"
            url={directUrl}
            openPath={`/r/${outletId}`}
            restaurantName={displayBrand}
            outletName={outletName}
            showQr
          />

          {!hasGpsLocation && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span>
                No GPS location set — customers won&apos;t see distance.{" "}
                {manageHref ? (
                  <>
                    <a href={manageHref} className="font-medium underline">
                      Open outlet settings
                    </a>{" "}
                    and pin on the map.
                  </>
                ) : (
                  <>Click Edit → Pin on map to add it.</>
                )}
              </span>
            </p>
          )}
        </CardContent>
      </Card>
    </FeatureGate>
  );
}

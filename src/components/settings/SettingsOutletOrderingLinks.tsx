import { Link } from "react-router-dom";
import { Globe, Link2, MapPin, Store } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FeatureGate } from "@/components/FeatureGate";
import { OrderingLinkRow } from "@/components/customer/OrderingLinkRow";

export interface SettingsOutletRow {
  id: string;
  name: string;
  latitude?: number | null;
}

interface SettingsOutletOrderingLinksProps {
  outlets: SettingsOutletRow[];
  brandName?: string | null;
  orderingSlug?: string | null;
  loading?: boolean;
}

export function SettingsOutletOrderingLinks({
  outlets,
  brandName,
  orderingSlug,
  loading,
}: SettingsOutletOrderingLinksProps) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const brandUrl = orderingSlug ? `${origin}/order/${orderingSlug}` : null;
  const displayBrand = brandName || "Your restaurant";

  return (
    <FeatureGate feature="customerOrdering" showUpgradePrompt>
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.06] via-background to-accent/[0.04]">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Globe className="h-4 w-4 text-primary" />
                </div>
                Online ordering links
              </CardTitle>
              <CardDescription className="mt-1.5 max-w-2xl">
                Share these with customers for direct online ordering — managed here per outlet, not on
                Integrations.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {outlets.length} outlet{outlets.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {brandUrl ? (
            <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Brand ordering page</p>
                  <p className="text-xs text-muted-foreground">
                    All outlets — customers see the nearest location first
                  </p>
                </div>
                <Badge className="bg-green-500/15 text-green-700 border-green-500/25 shrink-0">
                  Recommended
                </Badge>
              </div>
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
              Complete onboarding and set your ordering slug in Branding to get a multi-outlet brand link.
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Direct outlet links</p>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground py-4">Loading outlets…</p>
            ) : outlets.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Add an outlet to generate ordering links.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {outlets.map((outlet) => {
                  const directUrl = `${origin}/r/${outlet.id}`;
                  const hasGps = outlet.latitude != null;
                  return (
                    <div
                      key={outlet.id}
                      className="rounded-xl border border-border/80 bg-card/80 p-4 shadow-sm hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="p-2 rounded-lg gradient-primary shrink-0">
                          <Store className="h-3.5 w-3.5 text-primary-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{outlet.name}</p>
                          <p className="text-xs text-muted-foreground">Direct link for this location</p>
                        </div>
                      </div>
                      <OrderingLinkRow
                        label="Outlet link"
                        url={directUrl}
                        openPath={`/r/${outlet.id}`}
                        restaurantName={displayBrand}
                        outletName={outlet.name}
                        showQr
                      />
                      {!hasGps && (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200/80 rounded-lg px-3 py-2 mt-3 flex items-start gap-2">
                          <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span>
                            No GPS pin — customers won&apos;t see distance.{" "}
                            <Link
                              to={`/outlets/${outlet.id}`}
                              state={{ returnTo: "/settings?tab=outlets" }}
                              className="font-medium underline"
                            >
                              Edit outlet
                            </Link>{" "}
                            to add location.
                          </span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </FeatureGate>
  );
}

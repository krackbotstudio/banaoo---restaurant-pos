import { Link } from "react-router-dom";
import { PRODUCT_UPDATES, type ProductUpdateTag } from "@/content/product-updates";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Megaphone, Sparkles } from "lucide-react";
import { useProductTour } from "@/lib/product-tour/tour-context";

const TAG_LABELS: Record<ProductUpdateTag, string> = {
  new: "New",
  improved: "Improved",
  fix: "Fix",
};

const TAG_VARIANT: Record<ProductUpdateTag, "default" | "secondary" | "outline"> = {
  new: "default",
  improved: "secondary",
  fix: "outline",
};

export function DashboardUpdates() {
  const { openLauncher } = useProductTour();
  const updates = PRODUCT_UPDATES.slice(0, 4);

  return (
    <aside className="space-y-4" data-tour="dashboard-updates">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">Take the app tour</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Interactive walkthroughs for Dashboard, Orders, Menu, and Kitchen.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Button size="sm" className="w-full" variant="secondary" onClick={openLauncher}>
            Start a module tour
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <Megaphone className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            What&apos;s new
          </h3>
        </div>

        <div className="space-y-3">
          {updates.map((update) => (
            <Card key={update.id} className="shadow-none">
              <CardHeader className="pb-1 pt-3 px-4">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-medium leading-snug">{update.title}</CardTitle>
                  <Badge variant={TAG_VARIANT[update.tag]} className="text-[10px] shrink-0">
                    {TAG_LABELS[update.tag]}
                  </Badge>
                </div>
                <CardDescription className="text-xs leading-relaxed">{update.summary}</CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  {new Date(update.date).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                {update.href && (
                  <Button asChild variant="link" className="h-auto p-0 text-xs">
                    <Link to={update.href}>Learn more</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </aside>
  );
}

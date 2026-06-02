import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Boxes, IndianRupee, PackageX, TrendingDown } from "lucide-react";
import type { InventorySummary } from "@/lib/inventory";

export function InventoryStatsCards({ summary }: { summary: InventorySummary | null }) {
  const cards = [
    {
      label: "Total items",
      value: summary?.totalItems ?? 0,
      icon: Boxes,
      className: "text-primary",
    },
    {
      label: "Low stock",
      value: summary?.lowStock ?? 0,
      icon: TrendingDown,
      className: "text-amber-600",
    },
    {
      label: "Out of stock",
      value: summary?.outOfStock ?? 0,
      icon: PackageX,
      className: "text-destructive",
    },
    {
      label: "Stock value",
      value: summary?.stockValue ? `₹${summary.stockValue.toFixed(0)}` : "—",
      icon: IndianRupee,
      className: "text-emerald-600",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(({ label, value, icon: Icon, className }) => (
        <Card key={label}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold mt-1">{value}</p>
              </div>
              <Icon className={`h-8 w-8 ${className} opacity-80`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function InventoryLowStockAlert({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      {count} item{count === 1 ? "" : "s"} at or below low-stock threshold
    </div>
  );
}

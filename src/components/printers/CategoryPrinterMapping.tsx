import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { CategoryPrinterMapping, OutletPrintSettings, PrinterRecord } from "@/lib/print/types";
import { KITCHEN_PRINTER_TYPES, PRINTER_TYPE_LABELS } from "@/lib/print/types";
import { upsertCategoryMapping, deleteCategoryMapping } from "@/lib/print/printer-repository";

interface CategoryRow {
  id: string;
  name: string;
}

interface Props {
  outletId: string;
  printers: PrinterRecord[];
  mappings: CategoryPrinterMapping[];
  settings: OutletPrintSettings;
  onUpdated: () => void;
}

export function CategoryPrinterMappingPanel({
  outletId,
  printers,
  mappings,
  settings,
  onUpdated,
}: Props) {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const stationPrinters = printers.filter(
    (p) => p.enabled && (KITCHEN_PRINTER_TYPES.includes(p.printer_type) || p.printer_type === "kitchen")
  );
  const defaultKitchenId =
    settings.default_kitchen_printer_id ??
    stationPrinters.find((p) => p.printer_type === "kitchen")?.id ??
    "";

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("menu_categories")
        .select("id, name")
        .eq("outlet_id", outletId)
        .eq("is_active", true)
        .order("sort_order");
      if (error) toast.error(error.message);
      setCategories(data ?? []);
      setLoading(false);
    })();
  }, [outletId]);

  const mappingFor = (categoryId: string) => mappings.find((m) => m.category_id === categoryId)?.printer_id;

  const handleAssign = async (categoryId: string, printerId: string) => {
    setSavingId(categoryId);
    try {
      if (printerId === "__default__") {
        await deleteCategoryMapping(outletId, categoryId);
      } else {
        await upsertCategoryMapping(outletId, categoryId, printerId);
      }
      onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Category → printer mapping</CardTitle>
        <CardDescription>
          When an order is placed, items are sent to the printer assigned to their menu category.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">No menu categories yet. Add categories in Menu.</p>
        ) : (
          categories.map((cat) => {
            const current = mappingFor(cat.id) ?? "__default__";
            return (
              <div
                key={cat.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border p-3"
              >
                <span className="text-sm font-medium">{cat.name}</span>
                <Select
                  value={current}
                  disabled={savingId === cat.id || stationPrinters.length === 0}
                  onValueChange={(v) => void handleAssign(cat.id, v)}
                >
                  <SelectTrigger className="w-full sm:w-[220px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">
                      Default kitchen
                      {defaultKitchenId
                        ? ` (${stationPrinters.find((p) => p.id === defaultKitchenId)?.name ?? ""})`
                        : ""}
                    </SelectItem>
                    {stationPrinters.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} · {PRINTER_TYPE_LABELS[p.printer_type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })
        )}
        {stationPrinters.length === 0 ? (
          <p className="text-xs text-amber-600">Add and enable at least one kitchen/bar printer first.</p>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          disabled={!defaultKitchenId}
          onClick={async () => {
            for (const cat of categories) {
              if (defaultKitchenId) {
                await upsertCategoryMapping(outletId, cat.id, defaultKitchenId);
              }
            }
            toast.success("All categories assigned to default kitchen");
            onUpdated();
          }}
        >
          Assign all to default kitchen
        </Button>
      </CardContent>
    </Card>
  );
}

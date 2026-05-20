import type {
  CategoryPrinterMapping,
  OrderPrintMeta,
  OutletPrintSettings,
  PrinterRecord,
  PrinterType,
  RoutedPrintBatch,
  RoutedPrintItem,
  PrintJobType,
} from "./types";
import { KITCHEN_PRINTER_TYPES } from "./types";

function isKitchenType(t: PrinterType): boolean {
  return KITCHEN_PRINTER_TYPES.includes(t);
}

function resolveKitchenPrinter(
  categoryId: string | null | undefined,
  printers: PrinterRecord[],
  mappings: CategoryPrinterMapping[],
  settings: OutletPrintSettings
): PrinterRecord | null {
  const enabled = printers.filter((p) => p.enabled && isKitchenType(p.printer_type));
  if (enabled.length === 0) return null;

  if (settings.category_routing_enabled && categoryId) {
    const map = mappings.find((m) => m.category_id === categoryId);
    if (map) {
      const mapped = enabled.find((p) => p.id === map.printer_id);
      if (mapped) return mapped;
    }
  }

  if (settings.default_kitchen_printer_id) {
    const def = enabled.find((p) => p.id === settings.default_kitchen_printer_id);
    if (def) return def;
  }

  return enabled.find((p) => p.printer_type === "kitchen") ?? enabled[0];
}

function resolveBillingPrinter(
  printers: PrinterRecord[],
  settings: OutletPrintSettings
): PrinterRecord | null {
  const enabled = printers.filter((p) => p.enabled && p.printer_type === "billing");
  if (enabled.length === 0) return null;
  if (settings.default_billing_printer_id) {
    const def = enabled.find((p) => p.id === settings.default_billing_printer_id);
    if (def) return def;
  }
  return enabled[0];
}

/** Group order line items by target kitchen/station printer. */
export function routeKitchenBatches(input: {
  items: RoutedPrintItem[];
  meta: OrderPrintMeta;
  printers: PrinterRecord[];
  mappings: CategoryPrinterMapping[];
  settings: OutletPrintSettings;
  jobType?: PrintJobType;
}): RoutedPrintBatch[] {
  const jobType = input.jobType ?? "kot";
  const groups = new Map<string, RoutedPrintItem[]>();

  for (const item of input.items) {
    const printer = resolveKitchenPrinter(
      item.categoryId,
      input.printers,
      input.mappings,
      input.settings
    );
    if (!printer) continue;
    const list = groups.get(printer.id) ?? [];
    list.push(item);
    groups.set(printer.id, list);
  }

  const batches: RoutedPrintBatch[] = [];
  for (const [printerId, items] of groups) {
    const printer = input.printers.find((p) => p.id === printerId);
    if (!printer || items.length === 0) continue;
    batches.push({
      printer,
      jobType,
      items,
      meta: input.meta,
    });
  }
  return batches;
}

export function routeBillingBatch(input: {
  items: RoutedPrintItem[];
  meta: OrderPrintMeta;
  printers: PrinterRecord[];
  settings: OutletPrintSettings;
  jobType?: PrintJobType;
}): RoutedPrintBatch | null {
  const printer = resolveBillingPrinter(input.printers, input.settings);
  if (!printer) return null;
  return {
    printer,
    jobType: input.jobType ?? "bill",
    items: input.items,
    meta: input.meta,
  };
}

import { supabase } from "@/integrations/supabase/client";
import type {
  CategoryPrinterMapping,
  OutletPrintSettings,
  PrinterLayoutConfig,
  PrinterRecord,
  PrintJobRecord,
  PrintJobStatus,
  PrintJobType,
} from "./types";

const DEFAULT_OUTLET_PRINT_SETTINGS: Omit<OutletPrintSettings, "outlet_id"> = {
  category_routing_enabled: false,
  auto_cut: true,
  consolidated_dine_in: false,
  min_auto_print_amount: 0,
  default_billing_printer_id: null,
  default_kitchen_printer_id: null,
};

export async function fetchPrinters(outletId: string): Promise<PrinterRecord[]> {
  const { data, error } = await supabase
    .from("printers")
    .select("*")
    .eq("outlet_id", outletId)
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data ?? []) as PrinterRecord[];
}

export async function fetchOutletPrintSettings(outletId: string): Promise<OutletPrintSettings> {
  const { data, error } = await supabase
    .from("outlet_print_settings")
    .select("*")
    .eq("outlet_id", outletId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    return { outlet_id: outletId, ...DEFAULT_OUTLET_PRINT_SETTINGS };
  }
  return data as OutletPrintSettings;
}

export async function upsertOutletPrintSettings(
  settings: Partial<OutletPrintSettings> & { outlet_id: string }
): Promise<void> {
  const { error } = await supabase.from("outlet_print_settings").upsert(
    {
      ...DEFAULT_OUTLET_PRINT_SETTINGS,
      ...settings,
      outlet_id: settings.outlet_id,
    },
    { onConflict: "outlet_id" }
  );
  if (error) throw error;
}

export async function fetchCategoryMappings(outletId: string): Promise<CategoryPrinterMapping[]> {
  const { data, error } = await supabase
    .from("category_printer_mappings")
    .select("*")
    .eq("outlet_id", outletId);
  if (error) throw error;
  return (data ?? []) as CategoryPrinterMapping[];
}

export async function upsertCategoryMapping(
  outletId: string,
  categoryId: string,
  printerId: string
): Promise<void> {
  const { error } = await supabase.from("category_printer_mappings").upsert(
    { outlet_id: outletId, category_id: categoryId, printer_id: printerId },
    { onConflict: "outlet_id,category_id" }
  );
  if (error) throw error;
}

export async function deleteCategoryMapping(outletId: string, categoryId: string): Promise<void> {
  const { error } = await supabase
    .from("category_printer_mappings")
    .delete()
    .eq("outlet_id", outletId)
    .eq("category_id", categoryId);
  if (error) throw error;
}

export type PrinterInsert = Omit<
  PrinterRecord,
  "id" | "created_at" | "updated_at" | "last_tested_at" | "last_error"
>;

export async function createPrinter(row: PrinterInsert): Promise<PrinterRecord> {
  const { data, error } = await supabase.from("printers").insert(row).select().single();
  if (error) throw error;
  return data as PrinterRecord;
}

export async function updatePrinter(
  id: string,
  patch: Partial<PrinterInsert> & { last_tested_at?: string | null; last_error?: string | null }
): Promise<void> {
  const { error } = await supabase.from("printers").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deletePrinter(id: string): Promise<void> {
  const { error } = await supabase.from("printers").delete().eq("id", id);
  if (error) throw error;
}

export async function insertPrintJob(input: {
  outlet_id: string;
  printer_id: string | null;
  order_id?: string | null;
  job_type: PrintJobType;
  payload: Record<string, unknown>;
  status?: PrintJobStatus;
  device_label?: string;
}): Promise<PrintJobRecord> {
  const { data, error } = await supabase
    .from("print_jobs")
    .insert({
      outlet_id: input.outlet_id,
      printer_id: input.printer_id,
      order_id: input.order_id ?? null,
      job_type: input.job_type,
      payload: input.payload,
      status: input.status ?? "pending",
      device_label: input.device_label ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as PrintJobRecord;
}

export async function updatePrintJob(
  id: string,
  patch: Partial<Pick<PrintJobRecord, "status" | "attempts" | "last_error" | "printed_at">>
): Promise<void> {
  const { error } = await supabase.from("print_jobs").update(patch).eq("id", id);
  if (error) throw error;
}

export async function fetchRecentPrintJobs(
  outletId: string,
  limit = 50
): Promise<PrintJobRecord[]> {
  const { data, error } = await supabase
    .from("print_jobs")
    .select("*")
    .eq("outlet_id", outletId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as PrintJobRecord[];
}

export function defaultLayoutConfig(): PrinterLayoutConfig {
  return {
    paperWidthPreset: "58",
    paperWidthMm: 58,
    paperColumns: 32,
    paperWidth: 58,
    fontSize: 12,
    postPrintFeedLines: 4,
    showTearCutLine: true,
    dualKitchenCopies: false,
    dualBillingCopies: false,
    columnOffset: 0,
    amountColumnWidth: 10,
    boldTotalLine: false,
  };
}

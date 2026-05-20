import type { BillingReceiptData } from "@/lib/serial-printer";
import { routeKitchenBatches } from "./routing-engine";
import { executePrintBatch } from "./print-executor";
import { insertPrintJob, updatePrintJob } from "./printer-repository";
import { enqueueLocal, removeLocalJob, updateLocalJob } from "./print-queue";
import type {
  OrderPrintMeta,
  OutletPrintSettings,
  PrinterRecord,
  CategoryPrinterMapping,
  RoutedPrintItem,
} from "./types";

export interface FleetPrintContext {
  printers: PrinterRecord[];
  mappings: CategoryPrinterMapping[];
  settings: OutletPrintSettings;
}

export interface FleetPrintSummary {
  ok: boolean;
  total: number;
  succeeded: number;
  failed: number;
  results: Array<{ printerName: string; ok: boolean; message?: string }>;
}

const RETRY_DELAYS_MS = [0, 2000, 10000];

async function runWithRetry(
  fn: () => Promise<{ ok: boolean; message?: string }>,
  maxAttempts = 3
): Promise<{ ok: boolean; message?: string }> {
  let last: { ok: boolean; message?: string } = { ok: false, message: "Unknown" };
  for (let i = 0; i < maxAttempts; i++) {
    if (RETRY_DELAYS_MS[i]) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[i]));
    }
    last = await fn();
    if (last.ok) return last;
  }
  return last;
}

export async function printRoutedKitchen(
  ctx: FleetPrintContext,
  items: RoutedPrintItem[],
  meta: OrderPrintMeta,
  options?: { jobType?: "kot" | "kot_cancel" | "kot_delta"; skipAutoPrintCheck?: boolean }
): Promise<FleetPrintSummary> {
  const batches = routeKitchenBatches({
    items,
    meta,
    printers: ctx.printers,
    mappings: ctx.mappings,
    settings: ctx.settings,
    jobType: options?.jobType ?? "kot",
  });

  const toPrint = options?.skipAutoPrintCheck
    ? batches
    : batches.filter((b) => b.printer.auto_print);

  const results: FleetPrintSummary["results"] = [];

  for (const batch of toPrint) {
    for (let copy = 0; copy < batch.printer.copies; copy++) {
      const localId = crypto.randomUUID();
      enqueueLocal({
        id: localId,
        outletId: meta.outletId,
        printerId: batch.printer.id,
        jobType: batch.jobType,
        payload: { orderNumber: meta.orderNumber },
      });

      let jobId: string | null = null;
      try {
        const job = await insertPrintJob({
          outlet_id: meta.outletId,
          printer_id: batch.printer.id,
          order_id: meta.orderId ?? null,
          job_type: batch.jobType,
          payload: { orderNumber: meta.orderNumber, copy },
          status: "printing",
        });
        jobId = job.id;
      } catch {
        /* offline — local queue only */
      }

      const result = await runWithRetry(() => executePrintBatch(batch));

      if (jobId) {
        await updatePrintJob(jobId, {
          status: result.ok ? "done" : "failed",
          attempts: result.ok ? 1 : 3,
          last_error: result.message ?? null,
          printed_at: result.ok ? new Date().toISOString() : null,
        }).catch(() => {});
      }

      if (result.ok) removeLocalJob(localId);
      else updateLocalJob(localId, { lastError: result.message, attempts: 3 });

      results.push({
        printerName: batch.printer.name,
        ok: result.ok,
        message: result.message,
      });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  return {
    ok: succeeded === results.length && results.length > 0,
    total: results.length,
    succeeded,
    failed: results.length - succeeded,
    results,
  };
}

export async function printFleetHandoff(
  ctx: FleetPrintContext,
  items: RoutedPrintItem[],
  meta: OrderPrintMeta
): Promise<FleetPrintSummary> {
  const billing = ctx.printers.find((p) => p.enabled && p.printer_type === "billing");
  if (!billing) {
    return { ok: false, total: 0, succeeded: 0, failed: 0, results: [] };
  }
  const batch = {
    printer: billing,
    jobType: "handoff" as const,
    items,
    meta,
  };
  const result = await executePrintBatch(batch);
  return {
    ok: result.ok,
    total: 1,
    succeeded: result.ok ? 1 : 0,
    failed: result.ok ? 0 : 1,
    results: [{ printerName: billing.name, ok: result.ok, message: result.message }],
  };
}

export async function printFleetBill(
  ctx: FleetPrintContext,
  items: RoutedPrintItem[],
  meta: OrderPrintMeta,
  billingData: BillingReceiptData
): Promise<FleetPrintSummary> {
  const billing = ctx.printers.find((p) => p.enabled && p.printer_type === "billing");
  if (!billing) {
    return { ok: false, total: 0, succeeded: 0, failed: 0, results: [] };
  }
  const batch = {
    printer: billing,
    jobType: "bill" as const,
    items,
    meta,
  };
  const result = await executePrintBatch(batch, billingData);
  return {
    ok: result.ok,
    total: 1,
    succeeded: result.ok ? 1 : 0,
    failed: result.ok ? 0 : 1,
    results: [{ printerName: billing.name, ok: result.ok, message: result.message }],
  };
}

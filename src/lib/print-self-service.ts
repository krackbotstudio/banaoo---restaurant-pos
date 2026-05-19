import type { OutletPrinterSettings } from "@/lib/use-printer-settings";
import { printKitchenOrderSlip, type KitchenOrderPrintInput } from "@/lib/print-kitchen";
import { printCustomerTokenSlip, type CustomerTokenPrintInput } from "@/lib/print-customer-token";

export type SelfServicePrintResult = {
  ok: boolean;
  kitchenOk: boolean;
  tokenOk: boolean;
  message?: string;
};

export interface SelfServicePrintInput extends KitchenOrderPrintInput {
  outletName?: string;
  total: number;
  source?: string;
}

/** Counter flow: kitchen bill + customer token (billing printer). */
export async function printSelfServiceOrderSlips(
  settings: OutletPrinterSettings,
  input: SelfServicePrintInput
): Promise<SelfServicePrintResult> {
  const kitchenInput: KitchenOrderPrintInput = {
    ...input,
    selfServiceMode: true,
    source: input.source ?? "pos",
  };

  const tokenInput: CustomerTokenPrintInput = {
    outletId: input.outletId,
    outletName: input.outletName,
    orderNumber: input.orderNumber,
    orderType: input.orderType,
    tableNumber: input.tableNumber,
    items: input.items,
    total: input.total,
    createdAt: input.createdAt,
    source: input.source ?? "pos",
  };

  const kitchenResult = await printKitchenOrderSlip(settings, kitchenInput);
  const tokenResult = await printCustomerTokenSlip(settings, tokenInput);

  const kitchenOk = kitchenResult.ok;
  const tokenOk = tokenResult.ok;
  const ok = kitchenOk && tokenOk;

  let message: string | undefined;
  if (!kitchenOk && !tokenOk) {
    message = [kitchenResult.ok ? null : kitchenResult.message, tokenResult.ok ? null : tokenResult.message]
      .filter(Boolean)
      .join("; ");
  } else if (!kitchenOk) {
    message = kitchenResult.message;
  } else if (!tokenOk) {
    message = tokenResult.message;
  }

  return { ok, kitchenOk, tokenOk, message };
}

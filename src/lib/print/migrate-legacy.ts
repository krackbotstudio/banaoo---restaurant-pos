import { supabase } from "@/integrations/supabase/client";
import type { OutletPrinterSettings } from "@/lib/use-printer-settings";
import { createPrinter, fetchPrinters, defaultLayoutConfig } from "./printer-repository";
import { layoutPatchFromLegacy } from "./legacy-adapter";
import type { PrinterInsert } from "./printer-repository";

/** Seed Supabase printers from legacy localStorage kitchen/billing config (once). */
export async function migrateLegacyPrintersIfEmpty(
  outletId: string,
  legacy: OutletPrinterSettings
): Promise<void> {
  const existing = await fetchPrinters(outletId);
  if (existing.length > 0) return;

  const rows: PrinterInsert[] = [];

  const k = legacy.kitchenPrinter;
  if (k.name || k.usbPortIndex !== null || k.networkHost) {
    rows.push({
      outlet_id: outletId,
      name: k.name || "Kitchen Printer",
      printer_type: "kitchen",
      connection_type:
        k.transport === "network"
          ? "network"
          : k.transport === "bluetooth"
            ? "bluetooth"
            : k.transport === "usb"
              ? "usb"
              : "browser",
      enabled: true,
      auto_print: k.autoPrint,
      copies: 1,
      network_host: k.networkHost ?? "",
      network_port: k.networkPort ?? 9100,
      bluetooth_address: "",
      usb_port_index: k.usbPortIndex,
      baud_rate: k.baudRate ?? 9600,
      print_mode: k.printMode ?? "browser",
      layout_config: layoutPatchFromLegacy(k),
      sort_order: 0,
    });
  }

  const b = legacy.billingPrinter;
  if (b.name || b.usbPortIndex !== null || b.networkHost) {
    rows.push({
      outlet_id: outletId,
      name: b.name || "Cash Counter",
      printer_type: "billing",
      connection_type:
        b.transport === "network"
          ? "network"
          : b.transport === "bluetooth"
            ? "bluetooth"
            : b.transport === "usb"
              ? "usb"
              : "browser",
      enabled: true,
      auto_print: b.autoPrint,
      copies: 1,
      network_host: b.networkHost ?? "",
      network_port: b.networkPort ?? 9100,
      bluetooth_address: "",
      usb_port_index: b.usbPortIndex,
      baud_rate: b.baudRate ?? 9600,
      print_mode: b.printMode ?? "browser",
      layout_config: layoutPatchFromLegacy(b),
      sort_order: 1,
    });
  }

  if (rows.length === 0) {
    rows.push({
      outlet_id: outletId,
      name: "Kitchen Printer",
      printer_type: "kitchen",
      connection_type: "browser",
      enabled: false,
      auto_print: false,
      copies: 1,
      network_host: "",
      network_port: 9100,
      bluetooth_address: "",
      usb_port_index: null,
      baud_rate: 9600,
      print_mode: "browser",
      layout_config: defaultLayoutConfig(),
      sort_order: 0,
    });
    rows.push({
      outlet_id: outletId,
      name: "Cash Counter",
      printer_type: "billing",
      connection_type: "browser",
      enabled: false,
      auto_print: false,
      copies: 1,
      network_host: "",
      network_port: 9100,
      bluetooth_address: "",
      usb_port_index: null,
      baud_rate: 9600,
      print_mode: "browser",
      layout_config: defaultLayoutConfig(),
      sort_order: 1,
    });
  }

  for (const row of rows) {
    await createPrinter(row);
  }

  const { data: created } = await supabase.from("printers").select("id, printer_type").eq("outlet_id", outletId);
  const kitchenId = created?.find((p) => p.printer_type === "kitchen")?.id;
  const billingId = created?.find((p) => p.printer_type === "billing")?.id;
  if (kitchenId || billingId) {
    await supabase.from("outlet_print_settings").upsert(
      {
        outlet_id: outletId,
        default_kitchen_printer_id: kitchenId ?? null,
        default_billing_printer_id: billingId ?? null,
      },
      { onConflict: "outlet_id" }
    );
  }
}

import type { PrinterConfig, OutletPrinterSettings } from "@/lib/use-printer-settings";
import type { PrinterLayoutConfig, PrinterRecord } from "./types";

/** Map fleet printer row → legacy PrinterConfig for existing ESC/POS builders. */
export function printerRecordToConfig(p: PrinterRecord): PrinterConfig {
  const l = p.layout_config ?? {};
  return {
    name: p.name,
    transport:
      p.connection_type === "network"
        ? "network"
        : p.connection_type === "bluetooth"
          ? "bluetooth"
          : p.connection_type === "usb"
            ? "usb"
            : "browser",
    connectionType:
      p.connection_type === "bluetooth"
        ? "bluetooth"
        : p.connection_type === "usb"
          ? "usb"
          : "none",
    paperWidth: (l.paperWidth as 58 | 80) ?? 58,
    paperWidthPreset: l.paperWidthPreset ?? "58",
    paperWidthMm: l.paperWidthMm ?? 58,
    paperColumns: l.paperColumns ?? 32,
    autoPrint: p.auto_print,
    fontSize: l.fontSize ?? 12,
    baudRate: (p.baud_rate as 9600 | 19200 | 38400 | 115200) ?? 9600,
    printMode: p.print_mode,
    usbPortIndex: p.usb_port_index,
    networkHost: p.network_host,
    networkPort: p.network_port,
    postPrintFeedLines: l.postPrintFeedLines ?? 4,
    showTearCutLine: l.showTearCutLine !== false,
    dualKitchenCopies: l.dualKitchenCopies === true,
    dualBillingCopies: l.dualBillingCopies === true,
    columnOffset: l.columnOffset ?? 0,
    amountColumnWidth: l.amountColumnWidth ?? 10,
    boldTotalLine: l.boldTotalLine === true,
    selfServicePrintOnOrder: l.selfServicePrintOnOrder !== false,
    selfServiceBillWithHandoff: l.selfServiceBillWithHandoff !== false,
    selfServiceKitchenStationCopy: l.selfServiceKitchenStationCopy === true,
    lastTestedAt: p.last_tested_at ?? undefined,
  };
}

export function buildLegacySettingsFromFleet(
  printers: PrinterRecord[]
): OutletPrinterSettings {
  const kitchen =
    printers.find((p) => p.printer_type === "kitchen" && p.enabled) ??
    printers.find((p) => p.printer_type === "kitchen") ??
    printers.find((p) => p.enabled && p.printer_type !== "billing");
  const billing =
    printers.find((p) => p.printer_type === "billing" && p.enabled) ??
    printers.find((p) => p.printer_type === "billing");

  const defaultKitchen = kitchen ?? billing;
  const defaultBilling = billing ?? kitchen;

  return {
    version: 2,
    kitchenPrinter: defaultKitchen
      ? printerRecordToConfig(defaultKitchen)
      : printerRecordToConfig(emptyPrinter("kitchen")),
    billingPrinter: defaultBilling
      ? printerRecordToConfig(defaultBilling)
      : printerRecordToConfig(emptyPrinter("billing")),
  };
}

function emptyPrinter(type: "kitchen" | "billing"): PrinterRecord {
  return {
    id: "",
    outlet_id: "",
    name: type === "kitchen" ? "Kitchen" : "Billing",
    printer_type: type,
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
    layout_config: {},
    sort_order: 0,
    last_tested_at: null,
    last_error: null,
    created_at: "",
    updated_at: "",
  };
}

export function layoutPatchFromLegacy(config: Partial<PrinterConfig>): PrinterLayoutConfig {
  return {
    paperWidthPreset: config.paperWidthPreset,
    paperWidthMm: config.paperWidthMm,
    paperColumns: config.paperColumns,
    paperWidth: config.paperWidth,
    fontSize: config.fontSize,
    postPrintFeedLines: config.postPrintFeedLines,
    showTearCutLine: config.showTearCutLine,
    dualKitchenCopies: config.dualKitchenCopies,
    dualBillingCopies: config.dualBillingCopies,
    columnOffset: config.columnOffset,
    amountColumnWidth: config.amountColumnWidth,
    boldTotalLine: config.boldTotalLine,
    selfServicePrintOnOrder: config.selfServicePrintOnOrder,
    selfServiceBillWithHandoff: config.selfServiceBillWithHandoff,
    selfServiceKitchenStationCopy: config.selfServiceKitchenStationCopy,
  };
}

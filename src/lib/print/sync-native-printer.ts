import {
  isNativePrintCapable,
  postNativeSyncPrinter,
  type NativeSyncPrinterPayload,
} from "@/lib/native-print-bridge";
import type { PrinterRecord } from "./types";

function nativeRole(printerType: PrinterRecord["printer_type"]): "kitchen" | "billing" | null {
  if (printerType === "billing") return "billing";
  if (printerType === "kitchen") return "kitchen";
  return null;
}

/** Push fleet printer row into the APK native kitchen/billing storage for silent BT/LAN print. */
export function syncPrinterToNativeApp(printer: PrinterRecord): boolean {
  if (!isNativePrintCapable()) return false;
  const role = nativeRole(printer.printer_type);
  if (!role) return false;

  const layout = printer.layout_config ?? {};
  let transport: NativeSyncPrinterPayload["transport"] = "network";
  if (printer.connection_type === "bluetooth") {
    transport = layout.bluetoothMode === "ble" ? "bluetooth-ble" : "bluetooth-classic";
  } else if (printer.connection_type === "network") {
    transport = "network";
  } else {
    return false;
  }

  const payload: NativeSyncPrinterPayload = {
    outletId: printer.outlet_id,
    role,
    name: printer.name,
    transport,
    connectionId:
      printer.connection_type === "bluetooth"
        ? printer.bluetooth_address
        : printer.network_host,
    networkHost: printer.network_host,
    networkPort: printer.network_port,
    serviceUUID: layout.bleServiceUUID ?? "",
    characteristicUUID: layout.bleCharacteristicUUID ?? "",
    enabled: printer.enabled,
  };

  return postNativeSyncPrinter(payload);
}

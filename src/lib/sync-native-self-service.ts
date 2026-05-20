import {
  isNativePrintCapable,
  postNativeSyncSelfServiceSettings,
} from "@/lib/native-print-bridge";
import type { PrinterConfig } from "@/lib/use-printer-settings";

/** Push self-service print toggles from web Settings → Printers into the APK native store. */
export function syncSelfServicePrintToNative(
  outletId: string | null | undefined,
  billing: Pick<
    PrinterConfig,
    "selfServicePrintOnOrder" | "selfServiceBillWithHandoff" | "selfServiceKitchenStationCopy"
  >
): void {
  if (!outletId || !isNativePrintCapable()) return;
  postNativeSyncSelfServiceSettings({
    outletId,
    selfServicePrintOnOrder: billing.selfServicePrintOnOrder,
    selfServiceBillWithHandoff: billing.selfServiceBillWithHandoff,
    selfServiceKitchenStationCopy: billing.selfServiceKitchenStationCopy,
  });
}

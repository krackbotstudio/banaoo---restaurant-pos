import type { PaperWidthPresetId } from "@/lib/paper-width";

export type PrinterType = "billing" | "kitchen" | "bar" | "dessert" | "packing";
export type ConnectionType = "network" | "bluetooth" | "usb" | "browser";
export type PrintMode = "serial" | "browser";
export type PrintJobType =
  | "kot"
  | "kot_cancel"
  | "kot_delta"
  | "bill"
  | "handoff"
  | "customer_token";
export type PrintJobStatus = "pending" | "printing" | "done" | "failed";

export type BluetoothMode = "classic" | "ble";

export interface PrinterLayoutConfig {
  paperWidthPreset?: PaperWidthPresetId;
  paperWidthMm?: number;
  paperColumns?: number;
  paperWidth?: 58 | 80;
  fontSize?: number;
  postPrintFeedLines?: number;
  showTearCutLine?: boolean;
  dualKitchenCopies?: boolean;
  dualBillingCopies?: boolean;
  columnOffset?: number;
  amountColumnWidth?: number;
  boldTotalLine?: boolean;
  selfServicePrintOnOrder?: boolean;
  selfServiceBillWithHandoff?: boolean;
  selfServiceKitchenStationCopy?: boolean;
  /** Native Bluetooth: classic SPP vs BLE GATT */
  bluetoothMode?: BluetoothMode;
  bleServiceUUID?: string;
  bleCharacteristicUUID?: string;
}

export interface PrinterRecord {
  id: string;
  outlet_id: string;
  name: string;
  printer_type: PrinterType;
  connection_type: ConnectionType;
  enabled: boolean;
  auto_print: boolean;
  copies: number;
  network_host: string;
  network_port: number;
  bluetooth_address: string;
  usb_port_index: number | null;
  baud_rate: number;
  print_mode: PrintMode;
  layout_config: PrinterLayoutConfig;
  sort_order: number;
  last_tested_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface OutletPrintSettings {
  outlet_id: string;
  category_routing_enabled: boolean;
  auto_cut: boolean;
  consolidated_dine_in: boolean;
  min_auto_print_amount: number;
  default_billing_printer_id: string | null;
  default_kitchen_printer_id: string | null;
}

export interface CategoryPrinterMapping {
  id: string;
  outlet_id: string;
  category_id: string;
  printer_id: string;
}

export interface PrintJobRecord {
  id: string;
  outlet_id: string;
  printer_id: string | null;
  order_id: string | null;
  job_type: PrintJobType;
  payload: Record<string, unknown>;
  status: PrintJobStatus;
  attempts: number;
  last_error: string | null;
  device_label: string | null;
  created_at: string;
  printed_at: string | null;
}

export interface RoutedPrintItem {
  name: string;
  quantity: number;
  totalPrice?: number;
  gstRate?: number;
  categoryId?: string | null;
  notes?: string;
}

export interface OrderPrintMeta {
  outletId: string;
  orderId?: string;
  orderNumber: string;
  orderType: "dine_in" | "takeaway";
  tableNumber?: string;
  waiterName?: string;
  createdAt: Date;
  source?: string;
  selfServiceMode?: boolean;
}

export interface RoutedPrintBatch {
  printer: PrinterRecord;
  jobType: PrintJobType;
  items: RoutedPrintItem[];
  meta: OrderPrintMeta;
}

export const PRINTER_TYPE_LABELS: Record<PrinterType, string> = {
  billing: "Billing / Cash Counter",
  kitchen: "Kitchen",
  bar: "Bar",
  dessert: "Dessert",
  packing: "Packing",
};

export const CONNECTION_TYPE_LABELS: Record<ConnectionType, string> = {
  network: "Wi‑Fi / LAN",
  bluetooth: "Bluetooth",
  usb: "USB",
  browser: "Browser print",
};

export const BLUETOOTH_MODE_LABELS: Record<BluetoothMode, string> = {
  classic: "Bluetooth Classic (paired)",
  ble: "Bluetooth BLE",
};

/** Wizard-only connection choices (map to `connection_type` + `layout_config.bluetoothMode`). */
export type WizardConnectionChoice =
  | ConnectionType
  | "bluetooth_classic"
  | "bluetooth_ble";

export const WIZARD_CONNECTION_LABELS: Record<WizardConnectionChoice, string> = {
  network: CONNECTION_TYPE_LABELS.network,
  bluetooth: CONNECTION_TYPE_LABELS.bluetooth,
  bluetooth_classic: BLUETOOTH_MODE_LABELS.classic,
  bluetooth_ble: BLUETOOTH_MODE_LABELS.ble,
  usb: CONNECTION_TYPE_LABELS.usb,
  browser: CONNECTION_TYPE_LABELS.browser,
};

export function wizardChoiceToConnection(
  choice: WizardConnectionChoice
): { connectionType: ConnectionType; bluetoothMode?: BluetoothMode } {
  if (choice === "bluetooth_classic") return { connectionType: "bluetooth", bluetoothMode: "classic" };
  if (choice === "bluetooth_ble") return { connectionType: "bluetooth", bluetoothMode: "ble" };
  if (choice === "bluetooth") return { connectionType: "bluetooth", bluetoothMode: "classic" };
  return { connectionType: choice };
}

export function connectionToWizardChoice(
  connectionType: ConnectionType,
  layout?: PrinterLayoutConfig
): WizardConnectionChoice {
  if (connectionType === "bluetooth") {
    return layout?.bluetoothMode === "ble" ? "bluetooth_ble" : "bluetooth_classic";
  }
  return connectionType;
}

export const KITCHEN_PRINTER_TYPES: PrinterType[] = ["kitchen", "bar", "dessert", "packing"];

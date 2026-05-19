/** Shared printer transport labels for web Settings UI */

export type PrinterTransport = "bluetooth" | "usb" | "network" | "browser";

export const PRINTER_TRANSPORT_LABELS: Record<PrinterTransport, string> = {
  bluetooth: "Bluetooth",
  usb: "USB",
  network: "Wi‑Fi / LAN",
  browser: "Browser print dialog",
};

export const DEFAULT_NETWORK_PORT = 9100;

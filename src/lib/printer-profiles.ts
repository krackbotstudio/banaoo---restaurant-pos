import type { GrantedPort } from "@/lib/serial-printer";
import type { PaperWidthPresetId } from "@/lib/paper-width";

export interface PrinterProfileSuggestion {
  label: string;
  paperWidthPreset: PaperWidthPresetId;
  paperWidthMm: number;
  paperColumns: number;
  baudRate?: 9600 | 19200 | 38400 | 115200;
}

/** USB vendor:product → suggested layout (paper width is NOT detectable from chip ID alone). */
const USB_PROFILES: Record<string, PrinterProfileSuggestion> = {
  "04b8:0202": {
    label: "Epson thermal",
    paperWidthPreset: "80",
    paperWidthMm: 80,
    paperColumns: 48,
  },
  "04b8:0e15": {
    label: "Epson thermal",
    paperWidthPreset: "80",
    paperWidthMm: 80,
    paperColumns: 48,
  },
  "0519:0003": {
    label: "Star Micronics",
    paperWidthPreset: "80",
    paperWidthMm: 80,
    paperColumns: 48,
  },
  "1a86:7523": {
    label: "USB serial (CH340)",
    paperWidthPreset: "80",
    paperWidthMm: 80,
    paperColumns: 48,
    baudRate: 9600,
  },
  "1a86:55d4": {
    label: "USB serial (CH343)",
    paperWidthPreset: "80",
    paperWidthMm: 80,
    paperColumns: 48,
    baudRate: 9600,
  },
  "0403:6001": {
    label: "USB serial (FTDI)",
    paperWidthPreset: "80",
    paperWidthMm: 80,
    paperColumns: 48,
    baudRate: 9600,
  },
  "10c4:ea60": {
    label: "USB serial (CP2102)",
    paperWidthPreset: "80",
    paperWidthMm: 80,
    paperColumns: 48,
    baudRate: 9600,
  },
};

export function usbKey(vendorId?: number, productId?: number): string | null {
  if (vendorId == null || productId == null) return null;
  return `${vendorId.toString(16).padStart(4, "0")}:${productId.toString(16).padStart(4, "0")}`;
}

export function suggestProfileForPort(port: GrantedPort): PrinterProfileSuggestion | null {
  const key = usbKey(port.vendorId, port.productId);
  if (key && USB_PROFILES[key]) {
    return USB_PROFILES[key];
  }
  if (port.isBluetooth || (!port.vendorId && !port.productId)) {
    return {
      label: "Bluetooth serial",
      paperWidthPreset: "80",
      paperWidthMm: 80,
      paperColumns: 48,
      baudRate: 9600,
    };
  }
  return {
    label: port.label,
    paperWidthPreset: "80",
    paperWidthMm: 80,
    paperColumns: 48,
    baudRate: 9600,
  };
}

export function profileToConfigPatch(
  profile: PrinterProfileSuggestion
): Record<string, unknown> {
  return {
    paperWidthPreset: profile.paperWidthPreset,
    paperWidthMm: profile.paperWidthMm,
    paperColumns: profile.paperColumns,
    paperWidth: profile.paperWidthMm <= 60 ? 58 : 80,
    ...(profile.baudRate ? { baudRate: profile.baudRate } : {}),
  };
}

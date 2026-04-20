import { PermissionsAndroid, Platform } from "react-native";
import RNBluetoothClassic from "react-native-bluetooth-classic";
import { Buffer } from "buffer";

export interface ClassicPrinterDevice {
  id: string;
  name: string;
}

async function ensureAndroidClassicPermissions(): Promise<void> {
  if (Platform.OS !== "android") return;

  if (Platform.Version >= 31) {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    ]);
    const connectGranted =
      result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED;
    const scanGranted =
      result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED;
    if (!connectGranted || !scanGranted) {
      throw new Error("Bluetooth permissions denied. Allow Nearby devices to use classic Bluetooth printers.");
    }
    return;
  }

  const location = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  if (location !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error("Location permission denied. Android requires it for classic Bluetooth discovery.");
  }
}

export async function getPairedClassicPrinters(): Promise<ClassicPrinterDevice[]> {
  await ensureAndroidClassicPermissions();
  const enabled = await RNBluetoothClassic.isBluetoothEnabled();
  if (!enabled) {
    const accepted = await RNBluetoothClassic.requestBluetoothEnabled();
    if (!accepted) throw new Error("Bluetooth is disabled.");
  }

  const bonded = await RNBluetoothClassic.getBondedDevices();
  return bonded.map((device) => ({
    id: device.address || device.id,
    name: device.name || "Classic Bluetooth Printer",
  }));
}

export interface ClassicPrintOptions {
  deviceId: string;
  payload: Uint8Array;
}

export async function printViaClassic(options: ClassicPrintOptions): Promise<void> {
  await ensureAndroidClassicPermissions();
  const enabled = await RNBluetoothClassic.isBluetoothEnabled();
  if (!enabled) {
    const accepted = await RNBluetoothClassic.requestBluetoothEnabled();
    if (!accepted) throw new Error("Bluetooth is disabled.");
  }

  await RNBluetoothClassic.connectToDevice(options.deviceId);

  try {
    const bytes = Buffer.from(options.payload);
    const writeOk = await RNBluetoothClassic.writeToDevice(options.deviceId, bytes, "binary");
    if (!writeOk) {
      throw new Error("Classic Bluetooth write returned failure.");
    }
  } finally {
    try {
      await RNBluetoothClassic.disconnectFromDevice(options.deviceId);
    } catch {
      // Ignore disconnect cleanup failures.
    }
  }
}

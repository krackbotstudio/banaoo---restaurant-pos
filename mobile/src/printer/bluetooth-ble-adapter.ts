import { BleManager, Device, State } from "react-native-ble-plx";
import { PermissionsAndroid, Platform } from "react-native";

const manager = new BleManager();

export interface DiscoveredPrinter {
  id: string;
  name: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const hasB = i + 1 < bytes.length;
    const hasC = i + 2 < bytes.length;
    const b = hasB ? bytes[i + 1] : 0;
    const c = hasC ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;
    result += chars[(triple >> 18) & 0x3f];
    result += chars[(triple >> 12) & 0x3f];
    result += hasB ? chars[(triple >> 6) & 0x3f] : "=";
    result += hasC ? chars[triple & 0x3f] : "=";
  }
  return result;
}

export async function ensureBluetoothReady(): Promise<void> {
  await ensureAndroidBlePermissions();
  const state = await manager.state();
  if (state === State.PoweredOn) return;

  await new Promise<void>((resolve, reject) => {
    const sub = manager.onStateChange((next) => {
      if (next === State.PoweredOn) {
        sub.remove();
        resolve();
      }
    }, true);

    setTimeout(() => {
      sub.remove();
      reject(new Error("Bluetooth is not powered on"));
    }, 8000);
  });
}

async function ensureAndroidBlePermissions(): Promise<void> {
  if (Platform.OS !== "android") return;

  if (Platform.Version >= 31) {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    const scanGranted = result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED;
    const connectGranted = result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED;
    if (!scanGranted || !connectGranted) {
      throw new Error("Bluetooth permissions denied. Allow Nearby devices to scan printers.");
    }
    return;
  }

  const location = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  if (location !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error("Location permission denied. Android requires it for BLE scanning.");
  }
}

export async function scanBluetoothPrinters(timeoutMs = 6000): Promise<DiscoveredPrinter[]> {
  await ensureBluetoothReady();
  const map = new Map<string, DiscoveredPrinter>();

  return new Promise((resolve) => {
    manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        manager.stopDeviceScan();
        resolve(Array.from(map.values()));
        return;
      }
      if (!device?.id) return;
      const displayName = device.name || device.localName || "Unknown Bluetooth Device";
      map.set(device.id, { id: device.id, name: displayName });
    });

    setTimeout(() => {
      manager.stopDeviceScan();
      resolve(Array.from(map.values()));
    }, timeoutMs);
  });
}

export interface BlePrintOptions {
  deviceId: string;
  serviceUUID: string;
  characteristicUUID: string;
  payload: Uint8Array;
}

export async function printViaBle(options: BlePrintOptions): Promise<void> {
  await ensureBluetoothReady();
  let device: Device | null = null;
  try {
    device = await manager.connectToDevice(options.deviceId, { autoConnect: false });
    await device.discoverAllServicesAndCharacteristics();
    const encoded = bytesToBase64(options.payload);
    await manager.writeCharacteristicWithoutResponseForDevice(
      options.deviceId,
      options.serviceUUID,
      options.characteristicUUID,
      encoded
    );
  } finally {
    if (device?.isConnected()) {
      try {
        await manager.cancelDeviceConnection(options.deviceId);
      } catch {
        // Ignore disconnect errors.
      }
    }
  }
}

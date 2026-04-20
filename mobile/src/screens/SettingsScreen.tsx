import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useOutlet } from "../context/OutletContext";
import { getPrintCapability } from "../printer/printer-service";
import { usePrinterSettings } from "../printer/usePrinterSettings";
import { DiscoveredPrinter, scanBluetoothPrinters } from "../printer/bluetooth-ble-adapter";
import { tokens } from "../theme/tokens";

export function SettingsScreen() {
  const { signOut, profile } = useAuth();
  const { currentOutlet } = useOutlet();
  const { settings, updateKitchen, updateBilling } = usePrinterSettings(currentOutlet?.id);
  const capability = getPrintCapability();
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<DiscoveredPrinter[]>([]);

  const scanDevices = async () => {
    setScanning(true);
    try {
      const list = await scanBluetoothPrinters();
      setDevices([...list].sort((a, b) => a.name.localeCompare(b.name)));
    } finally {
      setScanning(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.text}>Role: {profile?.role || "unknown"}</Text>
      <Text style={styles.text}>
        This screen mirrors PWA printer intent with native BLE fields required for silent mobile printing.
      </Text>
      <Text style={styles.metaText}>Outlet: {currentOutlet?.name || "No outlet selected"}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Printer capability</Text>
        <Text style={styles.metaText}>Platform: {capability.platform}</Text>
        <Text style={styles.metaText}>
          Silent Bluetooth: {capability.supportsSilentBluetooth ? "Supported" : "Not supported"}
        </Text>
        <Text style={styles.metaText}>
          Dialog fallback: {capability.supportsDialogFallback ? "Supported" : "Not supported"}
        </Text>
        <Text style={styles.text}>{capability.message}</Text>
        <Pressable style={styles.scanBtn} onPress={scanDevices} disabled={scanning}>
          {scanning ? <ActivityIndicator color="#fff" /> : <Text style={styles.scanText}>Scan Bluetooth Devices</Text>}
        </Pressable>
        <Text style={styles.metaText}>Tip: Assign unique devices to Kitchen and Billing to prevent duplicate destination prints.</Text>
        {devices.map((device) => (
          <View key={device.id} style={styles.deviceRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.deviceName}>{device.name}</Text>
              <Text style={styles.deviceId}>{device.id}</Text>
            </View>
            <Pressable
              style={styles.assignBtn}
              onPress={() =>
                updateKitchen({
                  enabled: true,
                  name: device.name,
                  connectionId: device.id,
                })
              }
            >
              <Text style={styles.assignText}>Kitchen</Text>
            </Pressable>
            <Pressable
              style={styles.assignBtn}
              onPress={() =>
                updateBilling({
                  enabled: true,
                  name: device.name,
                  connectionId: device.id,
                })
              }
            >
              <Text style={styles.assignText}>Billing</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Kitchen Printer</Text>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Enabled</Text>
          <Switch
            value={settings.kitchenPrinter.enabled}
            onValueChange={(enabled) => updateKitchen({ enabled })}
          />
        </View>
        <TextInput
          style={styles.input}
          placeholder="Printer name (e.g. Kitchen Counter)"
          value={settings.kitchenPrinter.name}
          onChangeText={(name) => updateKitchen({ name })}
        />
        <TextInput
          style={styles.input}
          placeholder="Device id / MAC / alias"
          value={settings.kitchenPrinter.connectionId}
          onChangeText={(connectionId) => updateKitchen({ connectionId })}
        />
        <TextInput
          style={styles.input}
          placeholder="BLE Service UUID (required for silent mode)"
          value={settings.kitchenPrinter.serviceUUID}
          onChangeText={(serviceUUID) => updateKitchen({ serviceUUID })}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="BLE Characteristic UUID (required for silent mode)"
          value={settings.kitchenPrinter.characteristicUUID}
          onChangeText={(characteristicUUID) => updateKitchen({ characteristicUUID })}
          autoCapitalize="none"
        />
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Silent Mode</Text>
          <Switch
            value={settings.kitchenPrinter.mode === "silent"}
            onValueChange={(silent) => updateKitchen({ mode: silent ? "silent" : "dialog" })}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Billing Printer</Text>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Enabled</Text>
          <Switch
            value={settings.billingPrinter.enabled}
            onValueChange={(enabled) => updateBilling({ enabled })}
          />
        </View>
        <TextInput
          style={styles.input}
          placeholder="Printer name (e.g. Billing Counter)"
          value={settings.billingPrinter.name}
          onChangeText={(name) => updateBilling({ name })}
        />
        <TextInput
          style={styles.input}
          placeholder="Device id / MAC / alias"
          value={settings.billingPrinter.connectionId}
          onChangeText={(connectionId) => updateBilling({ connectionId })}
        />
        <TextInput
          style={styles.input}
          placeholder="BLE Service UUID (required for silent mode)"
          value={settings.billingPrinter.serviceUUID}
          onChangeText={(serviceUUID) => updateBilling({ serviceUUID })}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="BLE Characteristic UUID (required for silent mode)"
          value={settings.billingPrinter.characteristicUUID}
          onChangeText={(characteristicUUID) => updateBilling({ characteristicUUID })}
          autoCapitalize="none"
        />
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Silent Mode</Text>
          <Switch
            value={settings.billingPrinter.mode === "silent"}
            onValueChange={(silent) => updateBilling({ mode: silent ? "silent" : "dialog" })}
          />
        </View>
      </View>

      <Pressable style={styles.button} onPress={() => signOut()}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.mutedBackground,
  },
  content: {
    padding: 16,
    gap: 10,
  },
  title: { fontSize: 24, fontWeight: "700", color: tokens.colors.foreground },
  text: { color: tokens.colors.mutedForeground, lineHeight: 20 },
  metaText: { color: "#475569", lineHeight: 18 },
  card: {
    marginTop: 2,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 12,
    gap: 8,
  },
  cardTitle: { fontWeight: "700", fontSize: 15, color: "#0f172a" },
  label: { color: "#334155", fontWeight: "600" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#0f172a",
  },
  scanBtn: {
    marginTop: 6,
    borderRadius: 8,
    backgroundColor: "#0f172a",
    paddingVertical: 10,
    alignItems: "center",
  },
  scanText: { color: "#fff", fontWeight: "700" },
  deviceRow: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  deviceName: { color: "#0f172a", fontWeight: "600" },
  deviceId: { color: "#64748b", fontSize: 11 },
  assignBtn: {
    borderWidth: 1,
    borderColor: "#f97316",
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: "#fff7ed",
  },
  assignText: { color: "#c2410c", fontWeight: "700", fontSize: 12 },
  button: {
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#f97316",
    height: 44,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
});

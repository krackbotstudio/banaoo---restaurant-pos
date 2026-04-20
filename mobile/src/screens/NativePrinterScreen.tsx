import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { getPrintCapability, PrinterTransport } from "../printer/printer-service";
import { usePrinterSettings } from "../printer/usePrinterSettings";
import { useOutlet } from "../context/OutletContext";
import { DiscoveredPrinter, scanBluetoothPrinters } from "../printer/bluetooth-ble-adapter";
import { ClassicPrinterDevice, getPairedClassicPrinters } from "../printer/bluetooth-classic-adapter";
import { tokens } from "../theme/tokens";

export function NativePrinterScreen() {
  const { currentOutlet } = useOutlet();
  const { settings, updateKitchen, updateBilling } = usePrinterSettings(currentOutlet?.id);
  const capability = getPrintCapability();
  const [scanning, setScanning] = useState(false);
  const [bleDevices, setBleDevices] = useState<DiscoveredPrinter[]>([]);
  const [classicDevices, setClassicDevices] = useState<ClassicPrinterDevice[]>([]);
  const [scanMessage, setScanMessage] = useState<string>("");
  const [showKitchenAdvanced, setShowKitchenAdvanced] = useState(false);
  const [showBillingAdvanced, setShowBillingAdvanced] = useState(false);

  const scanBleDevices = async () => {
    setScanning(true);
    setScanMessage("");
    try {
      const list = await scanBluetoothPrinters();
      setBleDevices([...list].sort((a, b) => a.name.localeCompare(b.name)));
      if (list.length === 0) {
        setScanMessage("No BLE printers found. If your printer is Classic Bluetooth (SPP), it may not appear in BLE scan.");
      }
    } catch (err) {
      setScanMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  };

  const scanClassicDevices = async () => {
    setScanning(true);
    setScanMessage("");
    try {
      const list = await getPairedClassicPrinters();
      setClassicDevices([...list].sort((a, b) => a.name.localeCompare(b.name)));
      if (list.length === 0) {
        setScanMessage("No paired Classic devices found. Pair your printer first in Android Bluetooth settings.");
      }
    } catch (err) {
      setScanMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  };

  const setKitchenTransport = (transport: PrinterTransport) => {
    void updateKitchen({ transport });
  };

  const setBillingTransport = (transport: PrinterTransport) => {
    void updateBilling({ transport });
  };
  const setKitchenPaperWidth = (paperWidth: 58 | 80) => {
    void updateKitchen({ paperWidth });
  };
  const setBillingPaperWidth = (paperWidth: 58 | 80) => {
    void updateBilling({ paperWidth });
  };
  const setKitchenFontSize = (fontSize: number) => {
    void updateKitchen({ fontSize });
  };
  const setBillingFontSize = (fontSize: number) => {
    void updateBilling({ fontSize });
  };

  const showKitchenBleFields = settings.kitchenPrinter.transport !== "bluetooth-classic";
  const showBillingBleFields = settings.billingPrinter.transport !== "bluetooth-classic";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Native Printers</Text>
      <Text style={styles.text}>Configure only the required options for kitchen and billing print routing.</Text>
      <Text style={styles.metaText}>Outlet: {currentOutlet?.name || "Global default"}</Text>

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
        <View style={styles.scanRow}>
          <Pressable style={[styles.scanBtn, styles.scanHalf]} onPress={scanClassicDevices} disabled={scanning}>
            {scanning ? <ActivityIndicator color="#fff" /> : <Text style={styles.scanText}>Load Paired Classic</Text>}
          </Pressable>
          <Pressable style={[styles.scanBtn, styles.scanHalf]} onPress={scanBleDevices} disabled={scanning}>
            {scanning ? <ActivityIndicator color="#fff" /> : <Text style={styles.scanText}>Scan BLE Devices</Text>}
          </Pressable>
        </View>
        <Text style={styles.metaText}>
          For Seznik-type printers, use Classic Bluetooth and load paired devices.
        </Text>
        <Text style={styles.metaText}>Tip: Keep Kitchen and Billing assigned to different devices when needed.</Text>
        {scanMessage ? <Text style={styles.warnText}>{scanMessage}</Text> : null}
        {classicDevices.map((device) => (
          <View key={`classic-${device.id}`} style={styles.deviceRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.deviceName}>{device.name}</Text>
              <Text style={styles.deviceId}>{device.id} · Classic</Text>
            </View>
            <Pressable
              style={styles.assignBtn}
              onPress={() =>
                updateKitchen({
                  enabled: true,
                  transport: "bluetooth-classic",
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
                  transport: "bluetooth-classic",
                  name: device.name,
                  connectionId: device.id,
                })
              }
            >
              <Text style={styles.assignText}>Billing</Text>
            </Pressable>
          </View>
        ))}
        {bleDevices.map((device) => (
          <View key={device.id} style={styles.deviceRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.deviceName}>{device.name}</Text>
              <Text style={styles.deviceId}>{device.id} · BLE</Text>
            </View>
            <Pressable
              style={styles.assignBtn}
              onPress={() =>
                updateKitchen({
                  enabled: true,
                  transport: "bluetooth-ble",
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
                  transport: "bluetooth-ble",
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
        <Text style={styles.label}>Transport</Text>
        <View style={styles.segmentRow}>
          <Pressable
            style={[styles.segmentBtn, settings.kitchenPrinter.transport === "bluetooth-classic" && styles.segmentBtnActive]}
            onPress={() => setKitchenTransport("bluetooth-classic")}
          >
            <Text style={styles.segmentText}>Classic (SPP)</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, settings.kitchenPrinter.transport !== "bluetooth-classic" && styles.segmentBtnActive]}
            onPress={() => setKitchenTransport("bluetooth-ble")}
          >
            <Text style={styles.segmentText}>BLE</Text>
          </Pressable>
        </View>
        {showKitchenBleFields ? (
          <>
          <Pressable style={styles.advancedBtn} onPress={() => setShowKitchenAdvanced((prev) => !prev)}>
            <Text style={styles.advancedText}>
              {showKitchenAdvanced ? "Hide BLE Advanced Options" : "Show BLE Advanced Options"}
            </Text>
          </Pressable>
          {showKitchenAdvanced ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="BLE Service UUID (required for BLE)"
                value={settings.kitchenPrinter.serviceUUID}
                onChangeText={(serviceUUID) => updateKitchen({ serviceUUID })}
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder="BLE Characteristic UUID (required for BLE)"
                value={settings.kitchenPrinter.characteristicUUID}
                onChangeText={(characteristicUUID) => updateKitchen({ characteristicUUID })}
                autoCapitalize="none"
              />
            </>
          ) : null}
          </>
        ) : (
          <Text style={styles.metaText}>Classic transport uses the paired device address; no BLE UUIDs required.</Text>
        )}
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Silent Mode</Text>
          <Switch
            value={settings.kitchenPrinter.mode === "silent"}
            onValueChange={(silent) => updateKitchen({ mode: silent ? "silent" : "dialog" })}
          />
        </View>
        <Text style={styles.label}>Paper Width</Text>
        <View style={styles.segmentRow}>
          <Pressable
            style={[styles.segmentBtn, settings.kitchenPrinter.paperWidth === 58 && styles.segmentBtnActive]}
            onPress={() => setKitchenPaperWidth(58)}
          >
            <Text style={styles.segmentText}>58mm</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, settings.kitchenPrinter.paperWidth === 80 && styles.segmentBtnActive]}
            onPress={() => setKitchenPaperWidth(80)}
          >
            <Text style={styles.segmentText}>80mm</Text>
          </Pressable>
        </View>
        <Text style={styles.label}>Font Size</Text>
        <View style={styles.segmentRow}>
          {[10, 12, 14].map((size) => (
            <Pressable
              key={`k-fs-${size}`}
              style={[styles.segmentBtn, settings.kitchenPrinter.fontSize === size && styles.segmentBtnActive]}
              onPress={() => setKitchenFontSize(size)}
            >
              <Text style={styles.segmentText}>{size}pt</Text>
            </Pressable>
          ))}
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
        <Text style={styles.label}>Transport</Text>
        <View style={styles.segmentRow}>
          <Pressable
            style={[styles.segmentBtn, settings.billingPrinter.transport === "bluetooth-classic" && styles.segmentBtnActive]}
            onPress={() => setBillingTransport("bluetooth-classic")}
          >
            <Text style={styles.segmentText}>Classic (SPP)</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, settings.billingPrinter.transport !== "bluetooth-classic" && styles.segmentBtnActive]}
            onPress={() => setBillingTransport("bluetooth-ble")}
          >
            <Text style={styles.segmentText}>BLE</Text>
          </Pressable>
        </View>
        {showBillingBleFields ? (
          <>
          <Pressable style={styles.advancedBtn} onPress={() => setShowBillingAdvanced((prev) => !prev)}>
            <Text style={styles.advancedText}>
              {showBillingAdvanced ? "Hide BLE Advanced Options" : "Show BLE Advanced Options"}
            </Text>
          </Pressable>
          {showBillingAdvanced ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="BLE Service UUID (required for BLE)"
                value={settings.billingPrinter.serviceUUID}
                onChangeText={(serviceUUID) => updateBilling({ serviceUUID })}
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder="BLE Characteristic UUID (required for BLE)"
                value={settings.billingPrinter.characteristicUUID}
                onChangeText={(characteristicUUID) => updateBilling({ characteristicUUID })}
                autoCapitalize="none"
              />
            </>
          ) : null}
          </>
        ) : (
          <Text style={styles.metaText}>Classic transport uses the paired device address; no BLE UUIDs required.</Text>
        )}
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Silent Mode</Text>
          <Switch
            value={settings.billingPrinter.mode === "silent"}
            onValueChange={(silent) => updateBilling({ mode: silent ? "silent" : "dialog" })}
          />
        </View>
        <Text style={styles.label}>Paper Width</Text>
        <View style={styles.segmentRow}>
          <Pressable
            style={[styles.segmentBtn, settings.billingPrinter.paperWidth === 58 && styles.segmentBtnActive]}
            onPress={() => setBillingPaperWidth(58)}
          >
            <Text style={styles.segmentText}>58mm</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, settings.billingPrinter.paperWidth === 80 && styles.segmentBtnActive]}
            onPress={() => setBillingPaperWidth(80)}
          >
            <Text style={styles.segmentText}>80mm</Text>
          </Pressable>
        </View>
        <Text style={styles.label}>Font Size</Text>
        <View style={styles.segmentRow}>
          {[10, 12, 14].map((size) => (
            <Pressable
              key={`b-fs-${size}`}
              style={[styles.segmentBtn, settings.billingPrinter.fontSize === size && styles.segmentBtnActive]}
              onPress={() => setBillingFontSize(size)}
            >
              <Text style={styles.segmentText}>{size}pt</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.mutedBackground,
  },
  content: {
    padding: 14,
    gap: 12,
    paddingBottom: 28,
  },
  title: { fontSize: 24, fontWeight: "700", color: tokens.colors.foreground },
  text: { color: tokens.colors.mutedForeground, lineHeight: 20 },
  metaText: { color: "#475569", lineHeight: 18 },
  warnText: { color: "#92400e", lineHeight: 18, fontWeight: "600" },
  card: {
    marginTop: 2,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 12,
    gap: 10,
  },
  cardTitle: {
    fontWeight: "700",
    fontSize: 16,
    color: tokens.colors.foreground,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontWeight: "600",
    color: tokens.colors.foreground,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: "#fff",
  },
  scanBtn: {
    marginTop: 6,
    backgroundColor: tokens.colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  scanText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  scanRow: {
    flexDirection: "row",
    gap: 8,
  },
  scanHalf: {
    flex: 1,
  },
  segmentRow: {
    flexDirection: "row",
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentBtnActive: {
    borderColor: tokens.colors.primary,
    backgroundColor: "#fff7ed",
  },
  segmentText: {
    fontWeight: "700",
    fontSize: 12,
    color: tokens.colors.foreground,
  },
  advancedBtn: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
  advancedText: {
    color: tokens.colors.mutedForeground,
    fontWeight: "600",
    fontSize: 12,
  },
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 8,
  },
  deviceName: {
    fontWeight: "700",
    color: tokens.colors.foreground,
  },
  deviceId: {
    color: tokens.colors.mutedForeground,
    fontSize: 12,
  },
  assignBtn: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  assignText: {
    fontWeight: "700",
    color: tokens.colors.foreground,
    fontSize: 12,
  },
});

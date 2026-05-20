import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  getPrintCapability,
  PrinterTransport,
  printCalibrationSlip,
  testBillingPrint,
  testKitchenPrint,
} from "../printer/printer-service";
import { PaperLayoutSection } from "../printer/PaperLayoutSection";
import { testNetworkConnection } from "../printer/network-tcp-adapter";
import { usePrinterSettings } from "../printer/usePrinterSettings";
import { useOutlet } from "../context/OutletContext";
import { DiscoveredPrinter, scanBluetoothPrinters } from "../printer/bluetooth-ble-adapter";
import { ClassicPrinterDevice, getPairedClassicPrinters } from "../printer/bluetooth-classic-adapter";
import { tokens } from "../theme/tokens";

async function openSystemBluetoothSettings(): Promise<void> {
  try {
    if (Platform.OS === "android") {
      await Linking.openURL("intent:#Intent;action=android.settings.BLUETOOTH_SETTINGS;end");
      return;
    }
    await Linking.openSettings();
  } catch {
    try {
      await Linking.openSettings();
    } catch {
      /* ignore */
    }
  }
}

const ripple = { color: "rgba(249, 115, 22, 0.25)", borderless: false };

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
  const [testingKitchen, setTestingKitchen] = useState(false);
  const [testingBilling, setTestingBilling] = useState(false);
  const [testMessage, setTestMessage] = useState("");

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
  const [calibratingKitchen, setCalibratingKitchen] = useState(false);
  const [calibratingBilling, setCalibratingBilling] = useState(false);

  const setKitchenFontSize = (fontSize: number) => {
    void updateKitchen({ fontSize });
  };
  const setBillingFontSize = (fontSize: number) => {
    void updateBilling({ fontSize });
  };

  const showKitchenBleFields = settings.kitchenPrinter.transport === "bluetooth-ble";
  const showBillingBleFields = settings.billingPrinter.transport === "bluetooth-ble";
  const showKitchenNetwork = settings.kitchenPrinter.transport === "network";
  const showBillingNetwork = settings.billingPrinter.transport === "network";

  const runKitchenCalibration = async () => {
    setCalibratingKitchen(true);
    setTestMessage("");
    try {
      const k = settings.kitchenPrinter;
      if (!k.enabled) {
        setTestMessage("Enable kitchen printer first.");
        return;
      }
      const result = await printCalibrationSlip("kitchen", settings);
      setTestMessage(result.ok ? "Calibration slip sent." : result.message);
    } catch (err) {
      setTestMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setCalibratingKitchen(false);
    }
  };

  const runBillingCalibration = async () => {
    setCalibratingBilling(true);
    setTestMessage("");
    try {
      const b = settings.billingPrinter;
      if (!b.enabled) {
        setTestMessage("Enable billing printer first.");
        return;
      }
      const result = await printCalibrationSlip("billing", settings);
      setTestMessage(result.ok ? "Calibration slip sent." : result.message);
    } catch (err) {
      setTestMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setCalibratingBilling(false);
    }
  };

  const runKitchenTest = async () => {
    setTestingKitchen(true);
    setTestMessage("");
    try {
      const k = settings.kitchenPrinter;
      if (!k.enabled) {
        setTestMessage("Enable kitchen printer first.");
        return;
      }
      if (k.transport === "network") {
        await testNetworkConnection(k.networkHost || k.connectionId, k.networkPort || 9100);
        setTestMessage("Network test sent to kitchen printer.");
        return;
      }
      const result = await testKitchenPrint(settings);
      setTestMessage(result.ok ? result.message : result.message);
    } catch (err) {
      setTestMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setTestingKitchen(false);
    }
  };

  const runBillingTest = async () => {
    setTestingBilling(true);
    setTestMessage("");
    try {
      const b = settings.billingPrinter;
      if (!b.enabled) {
        setTestMessage("Enable billing printer first.");
        return;
      }
      if (b.transport === "network") {
        await testNetworkConnection(b.networkHost || b.connectionId, b.networkPort || 9100);
        setTestMessage("Network test sent to billing printer.");
        return;
      }
      const result = await testBillingPrint(settings);
      setTestMessage(result.ok ? result.message : result.message);
    } catch (err) {
      setTestMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setTestingBilling(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Image
          source={require("../../assets/icon.png")}
          style={styles.heroLogo}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        <View style={styles.heroTextCol}>
          <Text style={styles.title}>Native printer settings</Text>
          <Text style={styles.heroSubtitle}>
            Same intent as the web app Printers tab: pick devices, then assign Kitchen and Billing.
          </Text>
        </View>
      </View>
      <Text style={styles.outletLine}>Outlet: {currentOutlet?.name || "Global default"}</Text>

      <View style={styles.callout}>
        <Text style={styles.calloutTitle}>Mobile quick setup</Text>
        <Text style={styles.calloutStep}>1. Bluetooth: pair in system settings, then assign Kitchen / Billing.</Text>
        <Text style={styles.calloutStep}>2. Wi‑Fi/LAN: enter printer IP (port 9100) on the same shop network.</Text>
        <Text style={styles.calloutStep}>3. Use different devices for kitchen and billing when you can.</Text>
        <Pressable
          style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressedOpacity]}
          onPress={() => void openSystemBluetoothSettings()}
          accessibilityRole="button"
          accessibilityLabel="Open system Bluetooth settings"
          android_ripple={ripple}
        >
          <Text style={styles.outlineBtnText}>Open Bluetooth settings</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Printer capability</Text>
        <Text style={styles.cardDescription}>What this device can do for silent vs dialog printing.</Text>
        <Text style={styles.metaText}>Platform: {capability.platform}</Text>
        <Text style={styles.metaText}>
          Silent Bluetooth: {capability.supportsSilentBluetooth ? "Supported" : "Not supported"}
        </Text>
        <Text style={styles.metaText}>
          Wi‑Fi/LAN (TCP): {capability.supportsSilentNetwork ? "Supported" : "Not supported"}
        </Text>
        <Text style={styles.metaText}>
          Dialog fallback: {capability.supportsDialogFallback ? "Supported" : "Not supported"}
        </Text>
        <Text style={styles.text}>{capability.message}</Text>
        <View style={styles.scanRow}>
          <Pressable
            style={({ pressed }) => [
              styles.scanBtn,
              styles.scanHalf,
              scanning && styles.btnDisabled,
              pressed && !scanning && styles.pressedOpacity,
            ]}
            onPress={() => void scanClassicDevices()}
            disabled={scanning}
            accessibilityRole="button"
            accessibilityLabel="Load paired classic Bluetooth printers"
            android_ripple={ripple}
          >
            {scanning ? <ActivityIndicator color={tokens.colors.primaryForeground} /> : <Text style={styles.scanText}>Load Paired Classic</Text>}
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.scanBtn,
              styles.scanHalf,
              scanning && styles.btnDisabled,
              pressed && !scanning && styles.pressedOpacity,
            ]}
            onPress={() => void scanBleDevices()}
            disabled={scanning}
            accessibilityRole="button"
            accessibilityLabel="Scan for BLE printers"
            android_ripple={ripple}
          >
            {scanning ? <ActivityIndicator color={tokens.colors.primaryForeground} /> : <Text style={styles.scanText}>Scan BLE Devices</Text>}
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
              style={({ pressed }) => [styles.assignBtn, pressed && styles.pressedOpacity]}
              onPress={() =>
                void updateKitchen({
                  enabled: true,
                  transport: "bluetooth-classic",
                  name: device.name,
                  connectionId: device.id,
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`Assign ${device.name} to kitchen`}
              android_ripple={ripple}
            >
              <Text style={styles.assignText}>Kitchen</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.assignBtn, pressed && styles.pressedOpacity]}
              onPress={() =>
                void updateBilling({
                  enabled: true,
                  transport: "bluetooth-classic",
                  name: device.name,
                  connectionId: device.id,
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`Assign ${device.name} to billing`}
              android_ripple={ripple}
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
              style={({ pressed }) => [styles.assignBtn, pressed && styles.pressedOpacity]}
              onPress={() =>
                void updateKitchen({
                  enabled: true,
                  transport: "bluetooth-ble",
                  name: device.name,
                  connectionId: device.id,
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`Assign ${device.name} to kitchen`}
              android_ripple={ripple}
            >
              <Text style={styles.assignText}>Kitchen</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.assignBtn, pressed && styles.pressedOpacity]}
              onPress={() =>
                void updateBilling({
                  enabled: true,
                  transport: "bluetooth-ble",
                  name: device.name,
                  connectionId: device.id,
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`Assign ${device.name} to billing`}
              android_ripple={ripple}
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
        <Text style={styles.label}>Connection</Text>
        <View style={styles.segmentRow}>
          <Pressable
            style={[styles.segmentBtn, settings.kitchenPrinter.transport === "bluetooth-classic" && styles.segmentBtnActive]}
            onPress={() => setKitchenTransport("bluetooth-classic")}
          >
            <Text style={styles.segmentText}>Bluetooth</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, settings.kitchenPrinter.transport === "network" && styles.segmentBtnActive]}
            onPress={() => setKitchenTransport("network")}
          >
            <Text style={styles.segmentText}>Wi‑Fi/LAN</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, settings.kitchenPrinter.transport === "bluetooth-ble" && styles.segmentBtnActive]}
            onPress={() => setKitchenTransport("bluetooth-ble")}
          >
            <Text style={styles.segmentText}>BLE</Text>
          </Pressable>
        </View>
        {showKitchenNetwork ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Printer IP (e.g. 192.168.1.105)"
              value={settings.kitchenPrinter.networkHost}
              onChangeText={(networkHost) => updateKitchen({ networkHost, connectionId: networkHost })}
              autoCapitalize="none"
              keyboardType="decimal-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Port (default 9100)"
              value={String(settings.kitchenPrinter.networkPort || 9100)}
              onChangeText={(text) => updateKitchen({ networkPort: Number(text) || 9100 })}
              keyboardType="number-pad"
            />
            <Text style={styles.metaText}>Printer and tablet must be on the same shop Wi‑Fi or LAN.</Text>
          </>
        ) : (
          <TextInput
            style={styles.input}
            placeholder="Device id / MAC / alias"
            value={settings.kitchenPrinter.connectionId}
            onChangeText={(connectionId) => updateKitchen({ connectionId })}
          />
        )}
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
        ) : !showKitchenNetwork ? (
          <Text style={styles.metaText}>Classic Bluetooth uses the paired device address from the list above.</Text>
        ) : null}
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Silent Mode</Text>
          <Switch
            value={settings.kitchenPrinter.mode === "silent"}
            onValueChange={(silent) => updateKitchen({ mode: silent ? "silent" : "dialog" })}
          />
        </View>
        <PaperLayoutSection
          config={settings.kitchenPrinter}
          onUpdate={(patch) => void updateKitchen(patch)}
          onCalibration={() => void runKitchenCalibration()}
          calibrationDisabled={calibratingKitchen || testingKitchen}
        />
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

        <Text style={styles.sectionLabel}>Receipt layout</Text>
        <Text style={styles.metaText}>Blank feed before cut (1–24). Lower saves paper.</Text>
        <View style={styles.feedWrap}>
          {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map((n) => (
            <Pressable
              key={`k-feed-${n}`}
              style={[
                styles.feedChip,
                settings.kitchenPrinter.postPrintFeedLines === n && styles.segmentBtnActive,
              ]}
              onPress={() => void updateKitchen({ postPrintFeedLines: n })}
            >
              <Text style={styles.feedChipText}>{n}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Tear / cut guide</Text>
          <Switch
            value={settings.kitchenPrinter.showTearCutLine}
            onValueChange={(showTearCutLine) => void updateKitchen({ showTearCutLine })}
          />
        </View>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.label}>Two slips (kitchen + table/parcel)</Text>
            <Text style={styles.metaText}>One print: kitchen copy, then table or parcel copy.</Text>
          </View>
          <Switch
            value={settings.kitchenPrinter.dualKitchenCopies}
            onValueChange={(dualKitchenCopies) => void updateKitchen({ dualKitchenCopies })}
          />
        </View>
        <Pressable
          style={({ pressed }) => [styles.testBtn, testingKitchen && styles.btnDisabled, pressed && !testingKitchen && styles.pressedOpacity]}
          onPress={() => void runKitchenTest()}
          disabled={testingKitchen}
          accessibilityRole="button"
          accessibilityLabel="Test kitchen printer"
          android_ripple={ripple}
        >
          {testingKitchen ? (
            <ActivityIndicator color={tokens.colors.primaryForeground} />
          ) : (
            <Text style={styles.testBtnText}>Test kitchen print</Text>
          )}
        </Pressable>
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
        <Text style={styles.label}>Connection</Text>
        <View style={styles.segmentRow}>
          <Pressable
            style={[styles.segmentBtn, settings.billingPrinter.transport === "bluetooth-classic" && styles.segmentBtnActive]}
            onPress={() => setBillingTransport("bluetooth-classic")}
          >
            <Text style={styles.segmentText}>Bluetooth</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, settings.billingPrinter.transport === "network" && styles.segmentBtnActive]}
            onPress={() => setBillingTransport("network")}
          >
            <Text style={styles.segmentText}>Wi‑Fi/LAN</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentBtn, settings.billingPrinter.transport === "bluetooth-ble" && styles.segmentBtnActive]}
            onPress={() => setBillingTransport("bluetooth-ble")}
          >
            <Text style={styles.segmentText}>BLE</Text>
          </Pressable>
        </View>
        {showBillingNetwork ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Printer IP (e.g. 192.168.1.105)"
              value={settings.billingPrinter.networkHost}
              onChangeText={(networkHost) => updateBilling({ networkHost, connectionId: networkHost })}
              autoCapitalize="none"
              keyboardType="decimal-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Port (default 9100)"
              value={String(settings.billingPrinter.networkPort || 9100)}
              onChangeText={(text) => updateBilling({ networkPort: Number(text) || 9100 })}
              keyboardType="number-pad"
            />
            <Text style={styles.metaText}>Printer and tablet must be on the same shop Wi‑Fi or LAN.</Text>
          </>
        ) : (
          <TextInput
            style={styles.input}
            placeholder="Device id / MAC / alias"
            value={settings.billingPrinter.connectionId}
            onChangeText={(connectionId) => updateBilling({ connectionId })}
          />
        )}
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
        ) : !showBillingNetwork ? (
          <Text style={styles.metaText}>Classic Bluetooth uses the paired device address from the list above.</Text>
        ) : null}
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Silent Mode</Text>
          <Switch
            value={settings.billingPrinter.mode === "silent"}
            onValueChange={(silent) => updateBilling({ mode: silent ? "silent" : "dialog" })}
          />
        </View>
        <PaperLayoutSection
          config={settings.billingPrinter}
          onUpdate={(patch) => void updateBilling(patch)}
          onCalibration={() => void runBillingCalibration()}
          calibrationDisabled={calibratingBilling || testingBilling}
        />
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

        <Text style={styles.sectionLabel}>Receipt layout</Text>
        <Text style={styles.metaText}>Blank feed before cut (1–24). Lower saves paper.</Text>
        <View style={styles.feedWrap}>
          {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map((n) => (
            <Pressable
              key={`b-feed-${n}`}
              style={[
                styles.feedChip,
                settings.billingPrinter.postPrintFeedLines === n && styles.segmentBtnActive,
              ]}
              onPress={() => void updateBilling({ postPrintFeedLines: n })}
            >
              <Text style={styles.feedChipText}>{n}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Tear / cut guide</Text>
          <Switch
            value={settings.billingPrinter.showTearCutLine}
            onValueChange={(showTearCutLine) => void updateBilling({ showTearCutLine })}
          />
        </View>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.label}>Print bill when order is placed</Text>
            <Text style={styles.metaText}>Self service: full GST bill on billing printer.</Text>
          </View>
          <Switch
            value={settings.billingPrinter.selfServicePrintOnOrder}
            onValueChange={(selfServicePrintOnOrder) => void updateBilling({ selfServicePrintOnOrder })}
          />
        </View>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.label}>Kitchen slip after customer copy (separate slip)</Text>
            <Text style={styles.metaText}>Second print job after customer bill is cut (auto-cutter).</Text>
          </View>
          <Switch
            value={settings.billingPrinter.selfServiceBillWithHandoff}
            onValueChange={(selfServiceBillWithHandoff) =>
              void updateBilling({ selfServiceBillWithHandoff })
            }
          />
        </View>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.label}>Also print kitchen station copy</Text>
            <Text style={styles.metaText}>Optional slip on the kitchen printer.</Text>
          </View>
          <Switch
            value={settings.billingPrinter.selfServiceKitchenStationCopy}
            onValueChange={(selfServiceKitchenStationCopy) =>
              void updateBilling({ selfServiceKitchenStationCopy })
            }
          />
        </View>
        <Text style={styles.label}>Left offset (0–4)</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={String(settings.billingPrinter.columnOffset ?? 0)}
          onChangeText={(t) =>
            void updateBilling({
              columnOffset: Math.min(4, Math.max(0, Number(t) || 0)),
            })
          }
        />
        <Text style={styles.label}>Amount column width (8–14)</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={String(settings.billingPrinter.amountColumnWidth ?? 10)}
          onChangeText={(t) =>
            void updateBilling({
              amountColumnWidth: Math.min(14, Math.max(8, Number(t) || 10)),
            })
          }
        />
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Bold total line</Text>
          <Switch
            value={settings.billingPrinter.boldTotalLine}
            onValueChange={(boldTotalLine) => void updateBilling({ boldTotalLine })}
          />
        </View>
        <Pressable
          style={({ pressed }) => [styles.testBtn, testingBilling && styles.btnDisabled, pressed && !testingBilling && styles.pressedOpacity]}
          onPress={() => void runBillingTest()}
          disabled={testingBilling}
          accessibilityRole="button"
          accessibilityLabel="Test billing printer"
          android_ripple={ripple}
        >
          {testingBilling ? (
            <ActivityIndicator color={tokens.colors.primaryForeground} />
          ) : (
            <Text style={styles.testBtnText}>Test billing print</Text>
          )}
        </Pressable>
      </View>
      {testMessage ? (
        <View style={styles.testBanner}>
          <Text style={styles.testBannerText}>{testMessage}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 36,
    backgroundColor: tokens.colors.background,
  },
  hero: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  heroLogo: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  heroTextCol: {
    flex: 1,
    gap: 6,
  },
  title: { fontSize: 22, fontWeight: "800", color: tokens.colors.foreground, letterSpacing: -0.3 },
  heroSubtitle: {
    color: tokens.colors.mutedForeground,
    lineHeight: 20,
    fontSize: 14,
  },
  outletLine: {
    color: tokens.colors.mutedForeground,
    fontSize: 13,
    fontWeight: "600",
  },
  callout: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.warningBackground,
    padding: 14,
    gap: 8,
  },
  calloutTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: tokens.colors.foreground,
  },
  calloutStep: {
    fontSize: 13,
    color: tokens.colors.mutedForeground,
    lineHeight: 19,
    paddingLeft: 2,
  },
  outlineBtn: {
    marginTop: 4,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: tokens.colors.primary,
    borderRadius: tokens.radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: tokens.colors.background,
    minHeight: 44,
    justifyContent: "center",
  },
  outlineBtnText: {
    color: tokens.colors.warningForeground,
    fontWeight: "700",
    fontSize: 14,
  },
  pressedOpacity: { opacity: 0.88 },
  btnDisabled: { opacity: 0.55 },
  text: { color: tokens.colors.mutedForeground, lineHeight: 20, fontSize: 14 },
  metaText: { color: tokens.colors.mutedForeground, lineHeight: 18, fontSize: 13 },
  warnText: { color: tokens.colors.warningForeground, lineHeight: 18, fontWeight: "600", fontSize: 13 },
  card: {
    marginTop: 2,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 14,
    backgroundColor: tokens.colors.card,
    padding: 14,
    gap: 10,
    ...tokens.shadows.card,
  },
  cardTitle: {
    fontWeight: "800",
    fontSize: 17,
    color: tokens.colors.foreground,
  },
  cardDescription: {
    fontSize: 13,
    color: tokens.colors.mutedForeground,
    lineHeight: 18,
    marginTop: -2,
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
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: tokens.colors.mutedBackground,
    color: tokens.colors.foreground,
  },
  scanBtn: {
    marginTop: 6,
    backgroundColor: tokens.colors.primary,
    borderRadius: tokens.radius.md,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: tokens.colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  scanText: {
    color: tokens.colors.primaryForeground,
    fontWeight: "800",
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
    borderRadius: tokens.radius.md,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.background,
  },
  segmentBtnActive: {
    borderColor: tokens.colors.primary,
    backgroundColor: tokens.colors.warningBackground,
  },
  segmentText: {
    fontWeight: "800",
    fontSize: 12,
    color: tokens.colors.foreground,
  },
  advancedBtn: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.mutedBackground,
  },
  advancedText: {
    color: tokens.colors.warningForeground,
    fontWeight: "700",
    fontSize: 12,
  },
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    padding: 8,
    backgroundColor: tokens.colors.mutedBackground,
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
    borderColor: tokens.colors.primary,
    borderRadius: tokens.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: tokens.colors.warningBackground,
  },
  assignText: {
    fontWeight: "800",
    color: tokens.colors.warningForeground,
    fontSize: 12,
  },
  sectionLabel: {
    marginTop: 4,
    fontWeight: "800",
    fontSize: 14,
    color: tokens.colors.foreground,
  },
  feedWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  feedChip: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: tokens.colors.card,
  },
  feedChipText: {
    fontWeight: "800",
    fontSize: 13,
    color: tokens.colors.foreground,
  },
  testBtn: {
    marginTop: 8,
    backgroundColor: tokens.colors.primary,
    borderRadius: tokens.radius.md,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  testBtnText: {
    color: tokens.colors.primaryForeground,
    fontWeight: "800",
    fontSize: 14,
  },
  testBanner: {
    borderWidth: 1,
    borderColor: tokens.colors.primary,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.warningBackground,
    padding: 12,
  },
  testBannerText: {
    color: tokens.colors.foreground,
    fontWeight: "600",
    fontSize: 14,
    lineHeight: 20,
  },
});

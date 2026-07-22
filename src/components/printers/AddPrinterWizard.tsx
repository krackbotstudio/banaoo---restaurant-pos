import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Bluetooth, Loader2, FlaskConical, Search } from "lucide-react";
import { toast } from "sonner";
import {
  PRINTER_TYPE_LABELS,
  WIZARD_CONNECTION_LABELS,
  wizardChoiceToConnection,
  connectionToWizardChoice,
  type PrinterRecord,
  type PrinterType,
  type WizardConnectionChoice,
} from "@/lib/print/types";
import {
  createPrinter,
  updatePrinter,
  defaultLayoutConfig,
  upsertOutletPrintSettings,
  fetchOutletPrintSettings,
} from "@/lib/print/printer-repository";
import { executeTestPrint } from "@/lib/print/print-executor";
import { syncPrinterToNativeApp } from "@/lib/print/sync-native-printer";
import {
  requestAndGetPortIndex,
  getGrantedPorts,
  type GrantedPort,
} from "@/lib/serial-printer";
import {
  isNativePrintCapable,
  openNativePrinterSettings,
  postNativeBluetoothScan,
  subscribeBluetoothScanResult,
  type NativeBluetoothDevice,
} from "@/lib/native-print-bridge";
import { DEFAULT_NETWORK_PORT } from "@/lib/printer-types";

interface AddPrinterWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outletId: string;
  editPrinter: PrinterRecord | null;
  onSaved: () => void;
}

const NATIVE_CONNECTIONS: WizardConnectionChoice[] = [
  "network",
  "bluetooth_classic",
  "bluetooth_ble",
];
const WEB_CONNECTIONS: WizardConnectionChoice[] = ["network", "usb", "browser"];

export function AddPrinterWizard({
  open,
  onOpenChange,
  outletId,
  editPrinter,
  onSaved,
}: AddPrinterWizardProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [printerType, setPrinterType] = useState<PrinterType>("kitchen");
  const [wizardConnection, setWizardConnection] = useState<WizardConnectionChoice>("network");
  const [networkHost, setNetworkHost] = useState("");
  const [networkPort, setNetworkPort] = useState(String(DEFAULT_NETWORK_PORT));
  const [bluetoothAddress, setBluetoothAddress] = useState("");
  const [bleServiceUUID, setBleServiceUUID] = useState("");
  const [bleCharacteristicUUID, setBleCharacteristicUUID] = useState("");
  const [usbPortIndex, setUsbPortIndex] = useState<number | null>(null);
  const [ports, setPorts] = useState<GrantedPort[]>([]);
  const [copies, setCopies] = useState("1");
  const [autoPrint, setAutoPrint] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scannedDevices, setScannedDevices] = useState<NativeBluetoothDevice[]>([]);
  const inNative = isNativePrintCapable();

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setScannedDevices([]);
    if (editPrinter) {
      setName(editPrinter.name);
      setPrinterType(editPrinter.printer_type);
      setWizardConnection(connectionToWizardChoice(editPrinter.connection_type, editPrinter.layout_config));
      setNetworkHost(editPrinter.network_host);
      setNetworkPort(String(editPrinter.network_port));
      setBluetoothAddress(editPrinter.bluetooth_address);
      setBleServiceUUID(editPrinter.layout_config?.bleServiceUUID ?? "");
      setBleCharacteristicUUID(editPrinter.layout_config?.bleCharacteristicUUID ?? "");
      setUsbPortIndex(editPrinter.usb_port_index);
      setCopies(String(editPrinter.copies));
      setAutoPrint(editPrinter.auto_print);
    } else {
      setName("");
      setPrinterType("kitchen");
      setWizardConnection(inNative ? "bluetooth_classic" : "usb");
      setNetworkHost("");
      setNetworkPort(String(DEFAULT_NETWORK_PORT));
      setBluetoothAddress("");
      setBleServiceUUID("");
      setBleCharacteristicUUID("");
      setUsbPortIndex(null);
      setCopies("1");
      setAutoPrint(true);
    }
    getGrantedPorts().then(setPorts).catch(() => {});
  }, [open, editPrinter, inNative]);

  useEffect(() => {
    if (!open || !inNative) return;
    return subscribeBluetoothScanResult(({ devices, error }) => {
      setScanning(false);
      if (error) {
        toast.error(error);
        return;
      }
      setScannedDevices(devices);
      if (devices.length === 0) {
        toast.message("No devices found", {
          description:
            wizardConnection === "bluetooth_ble"
              ? "Ensure the printer is on and in range. Try Classic if it uses SPP pairing."
              : "Pair the printer in Android Bluetooth settings first, then scan again.",
        });
      } else {
        toast.success(`Found ${devices.length} device(s)`);
      }
    });
  }, [open, inNative, wizardConnection]);

  const { connectionType, bluetoothMode } = wizardChoiceToConnection(wizardConnection);
  const isBluetooth = connectionType === "bluetooth";
  const isBle = isBluetooth && bluetoothMode === "ble";

  const buildLayoutConfig = () => {
    const base = editPrinter?.layout_config ?? defaultLayoutConfig();
    if (!isBluetooth) return base;
    return {
      ...base,
      bluetoothMode: bluetoothMode ?? "classic",
      bleServiceUUID: bleServiceUUID.trim(),
      bleCharacteristicUUID: bleCharacteristicUUID.trim(),
    };
  };

  const buildRow = () => ({
    outlet_id: outletId,
    name: name.trim() || PRINTER_TYPE_LABELS[printerType],
    printer_type: printerType,
    connection_type: connectionType,
    enabled: true,
    auto_print: autoPrint,
    copies: Math.min(5, Math.max(1, parseInt(copies, 10) || 1)),
    network_host: connectionType === "network" ? networkHost.trim() : "",
    network_port: parseInt(networkPort, 10) || DEFAULT_NETWORK_PORT,
    bluetooth_address: isBluetooth ? bluetoothAddress.trim() : "",
    usb_port_index: connectionType === "usb" ? usbPortIndex : null,
    baud_rate: 9600,
    print_mode: connectionType === "browser" ? ("browser" as const) : ("serial" as const),
    layout_config: buildLayoutConfig(),
    sort_order: editPrinter?.sort_order ?? 0,
  });

  const ensureDefaults = async (saved: PrinterRecord) => {
    const settings = await fetchOutletPrintSettings(outletId);
    const patch: Parameters<typeof upsertOutletPrintSettings>[0] = { outlet_id: outletId };
    if (saved.printer_type === "billing" && !settings.default_billing_printer_id) {
      patch.default_billing_printer_id = saved.id;
    }
    if (saved.printer_type === "kitchen" && !settings.default_kitchen_printer_id) {
      patch.default_kitchen_printer_id = saved.id;
    }
    if (patch.default_billing_printer_id || patch.default_kitchen_printer_id) {
      await upsertOutletPrintSettings(patch);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Enter a printer name");
      return;
    }
    if (connectionType === "network" && !networkHost.trim()) {
      toast.error("Enter printer IP address");
      return;
    }
    if (isBluetooth && !bluetoothAddress.trim()) {
      toast.error("Select or enter a Bluetooth device address");
      return;
    }
    if (isBle && !bleServiceUUID.trim()) {
      toast.error("Enter BLE service UUID");
      return;
    }
    if (isBle && !bleCharacteristicUUID.trim()) {
      toast.error("Enter BLE characteristic UUID");
      return;
    }
    setSaving(true);
    try {
      let saved: PrinterRecord;
      if (editPrinter) {
        await updatePrinter(editPrinter.id, buildRow());
        saved = { ...editPrinter, ...buildRow(), id: editPrinter.id };
        toast.success("Printer updated");
      } else {
        saved = await createPrinter(buildRow());
        await ensureDefaults(saved);
        toast.success("Printer added");
      }
      syncPrinterToNativeApp(saved);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const draft: PrinterRecord = {
        id: editPrinter?.id ?? "test",
        ...buildRow(),
        created_at: "",
        updated_at: "",
        last_tested_at: null,
        last_error: null,
      };
      const result = await executeTestPrint(draft);
      if (result.ok) toast.success("Test print sent");
      else toast.error(result.message ?? "Test failed");
    } finally {
      setTesting(false);
    }
  };

  const pickUsbPort = async () => {
    try {
      const idx = await requestAndGetPortIndex();
      setUsbPortIndex(idx);
      const list = await getGrantedPorts();
      setPorts(list);
      toast.success(`USB port #${idx} selected`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open port");
    }
  };

  const runBluetoothScan = () => {
    if (!inNative) {
      toast.error("Bluetooth scan is only available in the Flaze mobile app");
      return;
    }
    setScanning(true);
    setScannedDevices([]);
    const posted = postNativeBluetoothScan(isBle ? "ble" : "classic");
    if (!posted) {
      setScanning(false);
      toast.error("Could not start scan. Reopen the Flaze app and try again.");
    }
  };

  const connectionOptions = inNative ? NATIVE_CONNECTIONS : WEB_CONNECTIONS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editPrinter ? "Configure printer" : "Add printer"}</DialogTitle>
          <DialogDescription>
            Step {step} of 2 — {step === 1 ? "Type & connection" : "Connection details"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Printer name</Label>
              <Input placeholder="e.g. Main Kitchen" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Printer type</Label>
              <Select value={printerType} onValueChange={(v) => setPrinterType(v as PrinterType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRINTER_TYPE_LABELS) as PrinterType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {PRINTER_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Connection type</Label>
              {inNative ? (
                <p className="text-xs text-muted-foreground">
                  Bluetooth Classic uses paired SPP printers. BLE is for GATT thermal printers.
                </p>
              ) : null}
              <RadioGroup
                value={wizardConnection}
                onValueChange={(v) => setWizardConnection(v as WizardConnectionChoice)}
                className="gap-2"
              >
                {connectionOptions.map((ct) => (
                  <div key={ct} className="flex items-center gap-2 rounded-lg border p-3">
                    <RadioGroupItem value={ct} id={`ct-${ct}`} />
                    <Label htmlFor={`ct-${ct}`} className="font-normal cursor-pointer flex-1">
                      {WIZARD_CONNECTION_LABELS[ct]}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {connectionType === "network" ? (
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-2">
                  <Label>IP address</Label>
                  <Input
                    placeholder="192.168.1.100"
                    value={networkHost}
                    onChange={(e) => setNetworkHost(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Port</Label>
                  <Input value={networkPort} onChange={(e) => setNetworkPort(e.target.value)} />
                </div>
              </div>
            ) : null}
            {connectionType === "usb" ? (
              <div className="space-y-2">
                <Label>USB / Serial port</Label>
                <Select
                  value={usbPortIndex === null ? "" : String(usbPortIndex)}
                  onValueChange={(v) => setUsbPortIndex(v === "" ? null : Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select port" />
                  </SelectTrigger>
                  <SelectContent>
                    {ports.map((p) => (
                      <SelectItem key={p.index} value={String(p.index)}>
                        {p.label || `Port ${p.index}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="sm" onClick={() => void pickUsbPort()}>
                  Detect USB printer
                </Button>
              </div>
            ) : null}
            {isBluetooth ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={scanning}
                    onClick={runBluetoothScan}
                  >
                    {scanning ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    Scan {isBle ? "BLE" : "paired"} devices
                  </Button>
                  {inNative ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        if (!openNativePrinterSettings()) {
                          toast.error("Open this screen in the Flaze app to pair Bluetooth printers.");
                        }
                      }}
                    >
                      <Bluetooth className="h-4 w-4" />
                      System pairing
                    </Button>
                  ) : null}
                </div>
                {scannedDevices.length > 0 ? (
                  <div className="space-y-1 max-h-32 overflow-y-auto rounded-lg border p-2">
                    {scannedDevices.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        className={`w-full text-left text-sm rounded px-2 py-1.5 hover:bg-muted ${
                          bluetoothAddress === d.id ? "bg-primary/10 font-medium" : ""
                        }`}
                        onClick={() => setBluetoothAddress(d.id)}
                      >
                        {d.name || "Unnamed"}{" "}
                        <span className="text-muted-foreground text-xs">({d.id})</span>
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label>{isBle ? "Device ID" : "MAC / device address"}</Label>
                  <Input
                    placeholder={isBle ? "BLE device UUID" : "e.g. 00:11:22:33:44:55"}
                    value={bluetoothAddress}
                    onChange={(e) => setBluetoothAddress(e.target.value)}
                  />
                </div>
                {isBle ? (
                  <>
                    <div className="space-y-2">
                      <Label>BLE service UUID</Label>
                      <Input
                        placeholder="000018f0-0000-1000-8000-00805f9b34fb"
                        value={bleServiceUUID}
                        onChange={(e) => setBleServiceUUID(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>BLE characteristic UUID</Label>
                      <Input
                        placeholder="00002af1-0000-1000-8000-00805f9b34fb"
                        value={bleCharacteristicUUID}
                        onChange={(e) => setBleCharacteristicUUID(e.target.value)}
                      />
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Copies</Label>
                <Input type="number" min={1} max={5} value={copies} onChange={(e) => setCopies(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {step === 2 ? (
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
          ) : null}
          {step === 2 ? (
            <Button
              type="button"
              variant="secondary"
              className="gap-2"
              disabled={testing}
              onClick={() => void handleTest()}
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
              Test print
            </Button>
          ) : null}
          {step === 1 ? (
            <Button type="button" className="flex-1" onClick={() => setStep(2)}>
              Next
            </Button>
          ) : (
            <Button type="button" className="flex-1" disabled={saving} onClick={() => void handleSave()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

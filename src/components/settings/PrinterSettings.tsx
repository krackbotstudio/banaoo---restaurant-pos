import { useState, useEffect } from "react";
import { useOutlet } from "@/lib/outlet-context";
import { usePrinterSettings, PrinterConfig } from "@/lib/use-printer-settings";
import {
  isWebSerialSupported,
  requestAndGetPortIndex,
  getGrantedPorts,
  GrantedPort,
  buildKitchenSlip,
  buildBillingReceipt,
  printViaSerial,
  testPortConnection,
} from "@/lib/serial-printer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bluetooth,
  Usb,
  FlaskConical,
  ChefHat,
  Receipt,
  RotateCcw,
  CheckCircle2,
  XCircle,
  WifiOff,
  Type,
  PlugZap,
  Loader2,
  RefreshCw,
  AlertCircle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

// ── Port detection panel ──────────────────────────────────────────────────────
type PortStatus = "idle" | "testing" | "ok" | "error";

function PortDetectionPanel({
  kitchenPortIndex,
  billingPortIndex,
  kitchenBaudRate,
  billingBaudRate,
  kitchenPrinterName,
  billingPrinterName,
  onAssignKitchen,
  onAssignBilling,
}: {
  kitchenPortIndex: number | null;
  billingPortIndex: number | null;
  kitchenBaudRate: number;
  billingBaudRate: number;
  kitchenPrinterName: string;
  billingPrinterName: string;
  onAssignKitchen: (index: number | null) => void;
  onAssignBilling: (index: number | null) => void;
}) {
  const [ports, setPorts] = useState<GrantedPort[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState<"usb" | "bluetooth" | null>(null);
  const [portStatus, setPortStatus] = useState<Record<number, PortStatus>>({});
  const [portError, setPortError] = useState<Record<number, string>>({});
  // Custom user-defined names per port index, stored in sessionStorage for this tab
  const [portNames, setPortNames] = useState<Record<number, string>>({});
  const [editingPort, setEditingPort] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const supported = isWebSerialSupported();
  const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

  const refresh = async () => {
    setRefreshing(true);
    try {
      setPorts(await getGrantedPorts());
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  // Mobile UX: after user pairs printers in OS settings and comes back,
  // refresh the granted serial port list automatically.
  useEffect(() => {
    const handleFocus = () => { refresh(); };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, []);

  // Derive effective display name for a port
  const portDisplayName = (port: GrantedPort): string => {
    if (portNames[port.index]) return portNames[port.index];
    if (port.index === kitchenPortIndex && kitchenPrinterName) return kitchenPrinterName;
    if (port.index === billingPortIndex && billingPrinterName) return billingPrinterName;
    return port.label;
  };

  const startRename = (port: GrantedPort) => {
    setEditingPort(port.index);
    setEditValue(portDisplayName(port));
  };

  const commitRename = (index: number) => {
    if (editValue.trim()) setPortNames((p) => ({ ...p, [index]: editValue.trim() }));
    setEditingPort(null);
  };

  const handleAdd = async (type: "usb" | "bluetooth") => {
    setAdding(type);
    try {
      const idx = await requestAndGetPortIndex(type);
      if (idx !== null) {
        await refresh();
        toast.success("Printer added — assign it to Kitchen or Billing below");
      }
    } finally {
      setAdding(null);
    }
  };

  const openPhoneBluetoothSettings = () => {
    if (!isAndroid) {
      toast.message("Open your phone Bluetooth settings and pair printers, then return and tap Refresh");
      return;
    }
    try {
      window.location.href = "intent:#Intent;action=android.settings.BLUETOOTH_SETTINGS;end";
    } catch {
      toast.message("Open Android Bluetooth settings manually, then come back and tap Refresh");
    }
  };

  const handleTest = async (portIndex: number) => {
    // Use the baud rate of whichever role this port is assigned to, else default 9600
    const baud = portIndex === kitchenPortIndex
      ? kitchenBaudRate
      : portIndex === billingPortIndex
        ? billingBaudRate
        : 9600;

    setPortStatus((s) => ({ ...s, [portIndex]: "testing" }));
    setPortError((e) => ({ ...e, [portIndex]: "" }));
    try {
      await testPortConnection(portIndex, baud);
      setPortStatus((s) => ({ ...s, [portIndex]: "ok" }));
      toast.success(`Port #${portIndex + 1} connected successfully`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setPortStatus((s) => ({ ...s, [portIndex]: "error" }));
      setPortError((e) => ({ ...e, [portIndex]: msg }));
      toast.error(`Port #${portIndex + 1} failed: ${msg}`);
    }
  };

  const toggleKitchen = (portIndex: number) =>
    onAssignKitchen(kitchenPortIndex === portIndex ? null : portIndex);
  const toggleBilling = (portIndex: number) =>
    onAssignBilling(billingPortIndex === portIndex ? null : portIndex);

  if (!supported) {
    return (
      <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Direct per-printer routing needs Web Serial (Chrome/Edge desktop)</p>
          <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
            This browser/device cannot expose serial COM ports, so billing and kitchen cannot be silently routed here.
            Use Chrome/Edge on laptop/desktop for one-device two-printer setup.
          </p>
          {isMobile && (
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
              On mobile, you can still use manual browser printing, but each print may ask for printer selection.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <PlugZap className="h-5 w-5" />
              Connected Printers
            </CardTitle>
            <CardDescription className="mt-1">
              Add your printers below, test each connection, then assign to Kitchen or Billing
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isMobile && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
            <p className="text-sm font-medium">Mobile quick setup for 2 printers</p>
            <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-0.5">
              <li>Pair both printers in your phone Bluetooth settings first</li>
              <li>Tap <strong>Add Bluetooth Printer</strong> twice</li>
              <li>Assign one as Kitchen and one as Billing</li>
              <li>Use <strong>Test</strong> on each port to verify output</li>
            </ol>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="h-8" onClick={openPhoneBluetoothSettings}>
                Open Bluetooth Settings
              </Button>
              <Button variant="outline" size="sm" className="h-8" onClick={refresh} disabled={refreshing}>
                Refresh Ports
              </Button>
            </div>
          </div>
        )}

        {/* Add printer buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => handleAdd("usb")}
            disabled={!!adding}
          >
            {adding === "usb" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Usb className="h-4 w-4" />}
            Add USB Printer
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => handleAdd("bluetooth")}
            disabled={!!adding}
          >
            {adding === "bluetooth" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bluetooth className="h-4 w-4" />}
            {isMobile ? "Pair / Add Bluetooth Printer" : "Add Bluetooth Printer"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">
          Make sure the printer is on and connected before clicking Add. Select the correct COM/Serial port from the browser picker.
        </p>

        <Separator />

        {/* Port list */}
        {ports.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <WifiOff className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">No printers added yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Use the Add buttons above to grant access to your printer port
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...ports]
              .sort((a, b) => Number(b.isBluetooth) - Number(a.isBluetooth))
              .map((port) => {
              const isKitchen = kitchenPortIndex === port.index;
              const isBilling = billingPortIndex === port.index;
              const status = portStatus[port.index] ?? "idle";
              const errMsg = portError[port.index];
              return (
                <div
                  key={port.index}
                  className={`rounded-xl border p-3 space-y-3 transition-colors ${
                    isKitchen || isBilling ? "border-primary/30 bg-primary/5" : "bg-card"
                  }`}
                >
                  {/* Top row: icon + name + test button */}
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      port.isBluetooth || (!port.vendorId && !port.productId)
                        ? "bg-blue-100 dark:bg-blue-950/50"
                        : "bg-muted"
                    }`}>
                      {port.isBluetooth || (!port.vendorId && !port.productId)
                        ? <Bluetooth className="h-5 w-5 text-blue-600" />
                        : <Usb className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      {editingPort === port.index ? (
                        <input
                          autoFocus
                          className="w-full text-sm font-medium bg-background border border-primary rounded px-2 py-0.5 outline-none"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => commitRename(port.index)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename(port.index);
                            if (e.key === "Escape") setEditingPort(null);
                          }}
                        />
                      ) : (
                        <button
                          className="text-sm font-medium truncate max-w-full text-left hover:text-primary transition-colors"
                          title="Click to rename"
                          onClick={() => startRename(port)}
                        >
                          {portDisplayName(port)}
                        </button>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Port #{port.index + 1} · {port.label}
                        {isKitchen && " · Kitchen"}
                        {isBilling && " · Billing"}
                      </p>
                    </div>
                    {/* Connection status icon */}
                    {status === "ok" && <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />}
                    {status === "error" && <XCircle className="h-5 w-5 text-destructive shrink-0" />}
                    {/* Test button */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-8 shrink-0"
                      onClick={() => handleTest(port.index)}
                      disabled={status === "testing"}
                    >
                      {status === "testing"
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Zap className="h-3.5 w-3.5" />}
                      Test
                    </Button>
                  </div>

                  {/* Error message + guidance */}
                  {status === "error" && errMsg && (
                    <div className="space-y-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                      <div className="flex gap-2">
                        <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        <p className="text-xs text-destructive font-medium">{errMsg}</p>
                      </div>
                      {errMsg.toLowerCase().includes("failed to open") && (
                        <div className="text-xs text-muted-foreground space-y-1 pl-6">
                          <p className="font-medium text-foreground">Port is locked by Windows. Fix it with one of these:</p>
                          {port.isBluetooth ? (
                            <ol className="list-decimal list-inside space-y-0.5">
                              <li>Open <strong>Windows Settings → Bluetooth</strong>, remove this printer</li>
                              <li>Re-pair the printer from Bluetooth settings</li>
                              <li>Come back and click <strong>Add Bluetooth Printer</strong> again</li>
                              <li>Or switch to USB — USB is more reliable for direct printing</li>
                            </ol>
                          ) : (
                            <ol className="list-decimal list-inside space-y-0.5">
                              <li>Open <strong>Windows Settings → Printers & scanners</strong></li>
                              <li>Find this printer and click <strong>Remove device</strong></li>
                              <li>Reconnect the USB cable and click <strong>Add USB Printer</strong> again</li>
                              <li>When Windows asks to install a driver, click <strong>Cancel</strong></li>
                            </ol>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Assign buttons */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={isKitchen ? "default" : "outline"}
                      className={`gap-1.5 flex-1 h-8 ${isKitchen ? "bg-green-600 hover:bg-green-700 border-green-600" : ""}`}
                      onClick={() => toggleKitchen(port.index)}
                    >
                      <ChefHat className="h-3.5 w-3.5" />
                      {isKitchen ? "Kitchen ✓" : "Set as Kitchen"}
                    </Button>
                    <Button
                      size="sm"
                      variant={isBilling ? "default" : "outline"}
                      className={`gap-1.5 flex-1 h-8 ${isBilling ? "bg-primary hover:bg-primary/90" : ""}`}
                      onClick={() => toggleBilling(port.index)}
                    >
                      <Receipt className="h-3.5 w-3.5" />
                      {isBilling ? "Billing ✓" : "Set as Billing"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Printer settings card ─────────────────────────────────────────────────────
interface PrinterCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  autoSwitchLabel: string;
  autoSwitchDescription: string;
  config: PrinterConfig;
  assignedPort: GrantedPort | null;
  onUpdate: (patch: Partial<PrinterConfig>) => void;
  isKitchen: boolean;
}

function PrinterCard({
  title,
  description,
  icon,
  autoSwitchLabel,
  autoSwitchDescription,
  config,
  assignedPort,
  onUpdate,
  isKitchen,
}: PrinterCardProps) {
  const [testing, setTesting] = useState(false);

  const handleTestPrint = async () => {
    setTesting(true);
    try {
      // Serial path — silent print (only when serial mode and port assigned)
      if (config.printMode === "serial" && config.usbPortIndex !== null) {
        try {
          const now = new Date();
          const bytes = isKitchen
            ? buildKitchenSlip({
                orderNumber: "TEST",
                orderType: "dine_in",
                tableNumber: "1",
                items: [{ name: "Test Item", quantity: 1 }],
                createdAt: now,
              }, config.paperWidth)
            : buildBillingReceipt({
                orderNumber: "TEST",
                outletName: config.name || "My Restaurant",
                orderType: "dine_in",
                tableNumber: "1",
                items: [{ name: "Test Item", quantity: 1, totalPrice: 100, gstRate: 5 }],
                subtotal: 100,
                discountAmt: 0,
                serviceTax: 0,
                serviceTaxPercent: 0,
                gstTotal: 5,
                grandTotal: 105,
                createdAt: now,
              }, config.paperWidth);
          await printViaSerial(config.usbPortIndex, bytes, config.baudRate);
          toast.success("Test printed successfully");
          onUpdate({ lastTestedAt: new Date().toISOString() });
          return;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          toast.warning(`Serial print failed (${msg}) — falling back to browser dialog`);
        }
      }

      // Browser fallback
      const pt = config.fontSize;
      const pw = config.paperWidth;
      const win = window.open("", "_blank", "width=220,height=450");
      if (!win) { toast.warning("Allow popups to use the test print feature"); return; }
      win.document.write(`<!DOCTYPE html>
<html><head>
  <meta charset="utf-8"/><meta name="color-scheme" content="light"/>
  <style>
    @page { size: ${pw}mm auto; margin: 0; }
    html,body { margin:0; padding:3mm 2mm; width:${pw}mm; background:#fff;
      font-family:'Courier New',Courier,monospace; font-size:${pt}pt; color:#000; }
    * { color:#000 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .c { text-align:center; } .dash { border-top:1px dashed #000; margin:4px 0; }
  </style>
</head><body>
  <div class="c" style="font-weight:bold;font-size:${pt + 2}pt">** TEST PRINT **</div>
  <div class="dash"></div>
  <div>${title}</div>
  <div style="font-size:${pt - 1}pt">${config.name || "Unnamed"} · ${pw}mm · ${pt}pt</div>
  <div class="dash"></div>
  <div class="c" style="font-size:${pt - 1}pt">— Print OK —</div>
  <div style="height:10mm"></div>
</body></html>`);
      win.document.close(); win.focus();
      setTimeout(() => { win.print(); win.close(); }, 400);
      onUpdate({ lastTestedAt: new Date().toISOString() });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">{icon}{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
          {assignedPort ? (
            <Badge className="bg-green-600 hover:bg-green-600 gap-1 shrink-0">
              <CheckCircle2 className="h-3 w-3" />
              {assignedPort.isBluetooth ? "Bluetooth" : "USB"} Connected
            </Badge>
          ) : (
            <Badge variant="secondary" className="shrink-0">Not Assigned</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Printer label */}
        <div className="space-y-2">
          <Label>Printer Label</Label>
          <Input
            placeholder={isKitchen ? "e.g. Kitchen Counter" : "e.g. Billing Counter"}
            value={config.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
          />
        </div>

        {/* Print mode — most important setting */}
        <div className="space-y-2">
          <Label>Print Method</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={() => onUpdate({ printMode: "browser" })}
              className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                config.printMode === "browser"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                config.printMode === "browser" ? "border-primary bg-primary" : "border-muted-foreground"
              }`}>
                {config.printMode === "browser" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
              </div>
              <div>
                <p className="text-sm font-medium">Windows USB Printer</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  For printers installed via USB001 / Windows driver (POS58, etc.).
                  Uses browser print dialog.
                </p>
              </div>
            </button>
            <button
              onClick={() => onUpdate({ printMode: "serial" })}
              className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                config.printMode === "serial"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                config.printMode === "serial" ? "border-primary bg-primary" : "border-muted-foreground"
              }`}>
                {config.printMode === "serial" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
              </div>
              <div>
                <p className="text-sm font-medium">Serial COM Port</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  For printers on COM3/COM4 etc. (CH340, Bluetooth SPP).
                  Prints silently, no dialog.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Serial mode: assigned port status */}
        {config.printMode === "serial" && (
          assignedPort ? (
            <div className="flex items-center gap-2 rounded-md bg-green-50 dark:bg-green-950/30 px-3 py-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              <span className="text-sm text-green-700 dark:text-green-400 font-medium">
                {assignedPort.label} — Port #{assignedPort.index + 1} · prints silently, no dialog
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
              <WifiOff className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground">
                No serial port assigned — use the Connected Printers panel above
              </span>
            </div>
          )
        )}

        {/* Browser mode: guidance */}
        {config.printMode === "browser" && (
          <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-1 dark:border-blue-800 dark:bg-blue-950/20">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Setup for Windows USB printer</p>
            <ol className="text-xs text-blue-700 dark:text-blue-400 space-y-0.5 list-decimal list-inside">
              <li>Make sure the printer is installed in Windows (it should appear in Printers &amp; scanners)</li>
              <li>Click <strong>Test Print</strong> below → when the dialog appears, select your printer</li>
              <li>Chrome remembers this selection for future prints from this page</li>
            </ol>
          </div>
        )}

        <Separator />

        {/* Paper width + baud rate (baud only for serial mode) */}
        <div className={`grid gap-3 ${config.printMode === "serial" ? "grid-cols-2" : "grid-cols-1 max-w-[200px]"}`}>
          <div className="space-y-2">
            <Label>Paper Width</Label>
            <Select
              value={String(config.paperWidth)}
              onValueChange={(v) => onUpdate({ paperWidth: Number(v) as 58 | 80 })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="58">58mm (standard)</SelectItem>
                <SelectItem value="80">80mm (wide)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {config.printMode === "serial" && (
            <div className="space-y-2">
              <Label>Baud Rate</Label>
              <Select
                value={String(config.baudRate)}
                onValueChange={(v) => onUpdate({ baudRate: Number(v) as 9600 | 19200 | 38400 | 115200 })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="9600">9600 (default)</SelectItem>
                  <SelectItem value="19200">19200</SelectItem>
                  <SelectItem value="38400">38400</SelectItem>
                  <SelectItem value="115200">115200</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <Separator />

        {/* Font size */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Type className="h-4 w-4" />
              Font Size
            </Label>
            <span className="text-sm font-semibold tabular-nums bg-muted px-2 py-0.5 rounded">
              {config.fontSize}pt
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-6">10</span>
            <input
              type="range" min={10} max={16} step={1} value={config.fontSize}
              onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
              className="flex-1 h-2 accent-primary cursor-pointer"
            />
            <span className="text-xs text-muted-foreground w-6 text-right">16</span>
          </div>
        </div>

        <Separator />

        {/* Auto-print toggle */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor={`autoprint-${title}`}>{autoSwitchLabel}</Label>
            <p className="text-sm text-muted-foreground">{autoSwitchDescription}</p>
          </div>
          <Switch
            id={`autoprint-${title}`}
            checked={config.autoPrint}
            onCheckedChange={(checked) => onUpdate({ autoPrint: checked })}
          />
        </div>

        {/* Test print */}
        <Button variant="outline" className="gap-2 w-full sm:w-auto" onClick={handleTestPrint} disabled={testing}>
          {testing
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <FlaskConical className="h-4 w-4" />}
          Test {isKitchen ? "Kitchen" : "Billing"} Print
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function PrinterSettings() {
  const { currentOutlet } = useOutlet();
  const { settings, updateKitchen, updateBilling, resetToDefaults } = usePrinterSettings(currentOutlet?.id);
  const [ports, setPorts] = useState<GrantedPort[]>([]);

  // Keep local port list in sync so cards can show assigned port info
  useEffect(() => {
    getGrantedPorts().then(setPorts).catch(() => {});
  }, [settings.kitchenPrinter.usbPortIndex, settings.billingPrinter.usbPortIndex]);

  const kitchenPort = ports.find((p) => p.index === settings.kitchenPrinter.usbPortIndex) ?? null;
  const billingPort = ports.find((p) => p.index === settings.billingPrinter.usbPortIndex) ?? null;

  return (
    <div className="space-y-6">
      {/* Step 1: Detect & assign */}
      <PortDetectionPanel
        kitchenPortIndex={settings.kitchenPrinter.usbPortIndex}
        billingPortIndex={settings.billingPrinter.usbPortIndex}
        kitchenBaudRate={settings.kitchenPrinter.baudRate}
        billingBaudRate={settings.billingPrinter.baudRate}
        kitchenPrinterName={settings.kitchenPrinter.name}
        billingPrinterName={settings.billingPrinter.name}
        onAssignKitchen={(idx) => {
          const assignedPort = idx === null ? null : ports.find((p) => p.index === idx) ?? null;
          updateKitchen({
            usbPortIndex: idx,
            ...(idx !== null ? {
              printMode: "serial",
              connectionType: assignedPort?.isBluetooth ? "bluetooth" : "usb",
            } : {}),
          });
          getGrantedPorts().then(setPorts).catch(() => {});
        }}
        onAssignBilling={(idx) => {
          const assignedPort = idx === null ? null : ports.find((p) => p.index === idx) ?? null;
          updateBilling({
            usbPortIndex: idx,
            ...(idx !== null ? {
              printMode: "serial",
              connectionType: assignedPort?.isBluetooth ? "bluetooth" : "usb",
            } : {}),
          });
          getGrantedPorts().then(setPorts).catch(() => {});
        }}
      />

      {/* Step 2: Per-printer settings */}
      <PrinterCard
        title="Kitchen Printer"
        description="Prints kitchen order slip when an order is placed"
        icon={<ChefHat className="h-5 w-5" />}
        autoSwitchLabel="Auto-print on new order"
        autoSwitchDescription="Automatically print kitchen slip when an order is placed"
        config={settings.kitchenPrinter}
        assignedPort={kitchenPort}
        onUpdate={updateKitchen}
        isKitchen={true}
      />

      <PrinterCard
        title="Billing Printer"
        description="Prints customer receipt from the billing counter"
        icon={<Receipt className="h-5 w-5" />}
        autoSwitchLabel="Auto-print on Print Bill"
        autoSwitchDescription="Automatically print receipt when Print Bill is clicked"
        config={settings.billingPrinter}
        assignedPort={billingPort}
        onUpdate={updateBilling}
        isKitchen={false}
      />

      {/* Reset */}
      <Card className="border-destructive/30">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Reset Printer Settings</p>
              <p className="text-sm text-muted-foreground">Clear all printer configuration for this outlet</p>
            </div>
            <Button
              variant="outline"
              className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 shrink-0"
              onClick={resetToDefaults}
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

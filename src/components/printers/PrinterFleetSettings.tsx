import { useState } from "react";
import { useOutlet } from "@/lib/outlet-context";
import { usePrintFleet } from "@/hooks/use-print-fleet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Printer,
  ChefHat,
  Receipt,
  Wine,
  Cake,
  Package,
  Settings2,
  History,
  Bluetooth,
  Loader2,
  Trash2,
  FlaskConical,
} from "lucide-react";
import { toast } from "sonner";
import {
  BLUETOOTH_MODE_LABELS,
  CONNECTION_TYPE_LABELS,
  PRINTER_TYPE_LABELS,
  type PrinterRecord,
  type PrinterType,
} from "@/lib/print/types";
import {
  updatePrinter,
  deletePrinter,
  fetchRecentPrintJobs,
} from "@/lib/print/printer-repository";
import { executeTestPrint } from "@/lib/print/print-executor";
import { AddPrinterWizard } from "./AddPrinterWizard";
import { PrintJobLogPanel } from "./PrintJobLog";
import { isNativePrintCapable, openNativePrinterSettings } from "@/lib/native-print-bridge";
import { useQuery } from "@tanstack/react-query";

const TYPE_ICONS: Record<PrinterType, React.ReactNode> = {
  billing: <Receipt className="h-4 w-4" />,
  kitchen: <ChefHat className="h-4 w-4" />,
  bar: <Wine className="h-4 w-4" />,
  dessert: <Cake className="h-4 w-4" />,
  packing: <Package className="h-4 w-4" />,
};

function connectionHint(p: PrinterRecord): string {
  if (p.connection_type === "network" && p.network_host) {
    return `${p.network_host}:${p.network_port}`;
  }
  if (p.connection_type === "bluetooth" && p.bluetooth_address) {
    const mode = p.layout_config?.bluetoothMode;
    const modeLabel = mode ? BLUETOOTH_MODE_LABELS[mode] : "Bluetooth";
    return `${modeLabel} · ${p.bluetooth_address}`;
  }
  if (p.connection_type === "bluetooth") {
    const mode = p.layout_config?.bluetoothMode;
    return mode ? BLUETOOTH_MODE_LABELS[mode] : CONNECTION_TYPE_LABELS.bluetooth;
  }
  if (p.connection_type === "usb" && p.usb_port_index !== null) {
    return `USB port #${p.usb_port_index}`;
  }
  return CONNECTION_TYPE_LABELS[p.connection_type];
}

export function PrinterFleetSettings() {
  const { currentOutlet } = useOutlet();
  const { printers, settings, isLoading, invalidate, updateOutletSettings } = usePrintFleet(
    currentOutlet?.id
  );

  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<PrinterRecord | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const jobsQuery = useQuery({
    queryKey: ["print-jobs", currentOutlet?.id],
    queryFn: () => fetchRecentPrintJobs(currentOutlet!.id, 40),
    enabled: !!currentOutlet?.id,
  });

  const handleToggleEnabled = async (p: PrinterRecord, enabled: boolean) => {
    try {
      await updatePrinter(p.id, { enabled });
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const handleTest = async (p: PrinterRecord) => {
    setTestingId(p.id);
    try {
      const result = await executeTestPrint(p);
      if (result.ok) {
        await updatePrinter(p.id, { last_tested_at: new Date().toISOString(), last_error: null });
        toast.success(`Test sent to ${p.name}`);
      } else {
        await updatePrinter(p.id, { last_error: result.message ?? "Failed" });
        toast.error(result.message ?? "Test failed");
      }
      invalidate();
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (p: PrinterRecord) => {
    if (!confirm(`Delete printer "${p.name}"?`)) return;
    try {
      await deletePrinter(p.id);
      toast.success("Printer removed");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  if (!currentOutlet) return null;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const inNative = isNativePrintCapable();

  return (
    <div className="space-y-6">
      {inNative ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Bluetooth & LAN on this device</p>
              <p className="text-xs text-muted-foreground">
                Add printers below with Classic or BLE, or use system pairing for advanced setup.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 shrink-0"
              onClick={() => {
                if (!openNativePrinterSettings()) {
                  toast.error("Native printer settings unavailable.");
                }
              }}
            >
              <Bluetooth className="h-4 w-4" />
              System pairing
            </Button>
          </CardContent>
        </Card>
      ) : (
        <p className="text-xs text-muted-foreground rounded-lg border p-3">
          Wi‑Fi/LAN and USB printing are available here. For Bluetooth Classic or BLE printers, use the{" "}
          <strong>Flaze Android app</strong>.
        </p>
      )}

      <Tabs defaultValue="printers" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="printers" className="gap-1.5">
            <Printer className="h-3.5 w-3.5" />
            Printers
          </TabsTrigger>
          <TabsTrigger value="log" className="gap-1.5">
            <History className="h-3.5 w-3.5" />
            Print log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="printers" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">Printer settings</CardTitle>
                  <CardDescription>
                    Billing prints receipts; kitchen prints KOTs. One printer per role is enough for most outlets.
                  </CardDescription>
                </div>
                <Button
                  className="gap-2 shrink-0"
                  onClick={() => {
                    setEditingPrinter(null);
                    setWizardOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Add printer
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings ? (
                <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                  <div>
                    <Label className="text-sm">Auto cut after print</Label>
                    <p className="text-xs text-muted-foreground">Send cutter command after each job</p>
                  </div>
                  <Switch
                    checked={settings.auto_cut}
                    onCheckedChange={(v) =>
                      void updateOutletSettings({ outlet_id: currentOutlet.id, auto_cut: v })
                    }
                  />
                </div>
              ) : null}

              <Separator />

              {printers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No printers yet. Tap Add printer to set up your first device.
                </p>
              ) : (
                <div className="space-y-2">
                  {printers.map((p) => (
                    <div
                      key={p.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border p-3"
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="p-2 rounded-md bg-muted shrink-0">{TYPE_ICONS[p.printer_type]}</div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{p.name}</span>
                            <Badge variant="secondary" className="text-[10px]">
                              {PRINTER_TYPE_LABELS[p.printer_type]}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{connectionHint(p)}</p>
                          {p.last_error ? (
                            <p className="text-xs text-destructive mt-0.5">{p.last_error}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        <Switch checked={p.enabled} onCheckedChange={(v) => void handleToggleEnabled(p, v)} />
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={testingId === p.id}
                          onClick={() => void handleTest(p)}
                        >
                          {testingId === p.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <FlaskConical className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingPrinter(p);
                            setWizardOpen(true);
                          }}
                        >
                          <Settings2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => void handleDelete(p)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="log" className="mt-4">
          <PrintJobLogPanel jobs={jobsQuery.data ?? []} isLoading={jobsQuery.isLoading} />
        </TabsContent>
      </Tabs>

      <AddPrinterWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        outletId={currentOutlet.id}
        editPrinter={editingPrinter}
        onSaved={() => {
          invalidate();
          setWizardOpen(false);
          setEditingPrinter(null);
        }}
      />
    </div>
  );
}

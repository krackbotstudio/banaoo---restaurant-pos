import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { PrinterConfig } from "@/lib/use-printer-settings";

interface ReceiptAlignmentControlsProps {
  config: PrinterConfig;
  onUpdate: (patch: Partial<PrinterConfig>) => void;
}

export function ReceiptAlignmentControls({ config, onUpdate }: ReceiptAlignmentControlsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Paper &amp; alignment</Label>
        <p className="text-xs text-muted-foreground">
          If lines wrap or totals split (e.g. &quot;Rs.&quot; broken), reduce columns or add left offset.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-sm">Left offset (0–4 spaces)</Label>
          <Input
            type="number"
            min={0}
            max={4}
            value={config.columnOffset}
            onChange={(e) =>
              onUpdate({
                columnOffset: Math.min(4, Math.max(0, Number(e.target.value) || 0)),
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm">Amount column width</Label>
          <Input
            type="number"
            min={8}
            max={14}
            value={config.amountColumnWidth}
            onChange={(e) =>
              onUpdate({
                amountColumnWidth: Math.min(14, Math.max(8, Number(e.target.value) || 10)),
              })
            }
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Label className="text-sm">Bold total line</Label>
          <p className="text-xs text-muted-foreground">
            Off recommended on 58mm — avoids broken total amounts on narrow paper.
          </p>
        </div>
        <Switch
          checked={config.boldTotalLine}
          onCheckedChange={(boldTotalLine) => onUpdate({ boldTotalLine })}
        />
      </div>
    </div>
  );
}

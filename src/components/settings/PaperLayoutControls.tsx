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
import type { PrinterConfig } from "@/lib/use-printer-settings";
import {
  PAPER_PRESETS,
  COLUMN_MIN,
  COLUMN_MAX,
  adjustColumns,
  formatLayoutSummary,
  resolvePaperLayout,
  type PaperWidthPresetId,
} from "@/lib/paper-width";
import { Minus, Plus, Ruler } from "lucide-react";

interface PaperLayoutControlsProps {
  config: PrinterConfig;
  onUpdate: (patch: Partial<PrinterConfig>) => void;
  onCalibrationPrint?: () => void;
  calibrationDisabled?: boolean;
}

export function PaperLayoutControls({
  config,
  onUpdate,
  onCalibrationPrint,
  calibrationDisabled,
}: PaperLayoutControlsProps) {
  const layout = resolvePaperLayout(config);
  const isCustom = config.paperWidthPreset === "custom";

  const applyPreset = (presetId: PaperWidthPresetId) => {
    if (presetId === "custom") {
      onUpdate({
        paperWidthPreset: "custom",
        paperWidthMm: config.paperWidthMm ?? 58,
        paperColumns: config.paperColumns ?? 32,
      });
      return;
    }
    const preset = PAPER_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    onUpdate({
      paperWidthPreset: presetId,
      paperWidthMm: preset.mm,
      paperColumns: preset.defaultColumns,
      paperWidth: preset.mm <= 60 ? 58 : 80,
    });
  };

  const bumpColumns = (delta: number) => {
    const next = adjustColumns(layout, delta);
    onUpdate({
      paperWidthPreset: "custom",
      paperWidthMm: next.paperWidthMm,
      paperColumns: next.columns,
      paperWidth: next.paperWidthMm <= 60 ? 58 : 80,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Paper width preset</Label>
        <Select
          value={config.paperWidthPreset}
          onValueChange={(v) => applyPreset(v as PaperWidthPresetId)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAPER_PRESETS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label} ({p.defaultColumns} cols)
              </SelectItem>
            ))}
            <SelectItem value="custom">Custom (manual mm + columns)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Active: {formatLayoutSummary(layout)} — match the physical roll in the printer.
        </p>
      </div>

      {isCustom && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Width (mm)</Label>
            <Input
              type="number"
              min={32}
              max={120}
              value={config.paperWidthMm}
              onChange={(e) => {
                const mm = Math.max(32, Math.min(120, Number(e.target.value) || 58));
                onUpdate({
                  paperWidthMm: mm,
                  paperWidth: mm <= 60 ? 58 : 80,
                });
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Columns (chars per line)</Label>
            <Input
              type="number"
              min={COLUMN_MIN}
              max={COLUMN_MAX}
              value={config.paperColumns}
              onChange={(e) => {
                const columns = Math.max(
                  COLUMN_MIN,
                  Math.min(COLUMN_MAX, Number(e.target.value) || 32)
                );
                onUpdate({ paperColumns: columns });
              }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground mr-1">Tune columns:</span>
        <Button type="button" variant="outline" size="sm" onClick={() => bumpColumns(-2)}>
          <Minus className="h-3 w-3 mr-1" />
          Narrower
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => bumpColumns(2)}>
          <Plus className="h-3 w-3 mr-1" />
          Wider
        </Button>
        {onCalibrationPrint && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1"
            disabled={calibrationDisabled}
            onClick={onCalibrationPrint}
          >
            <Ruler className="h-3.5 w-3.5" />
            Calibration print
          </Button>
        )}
      </div>
    </div>
  );
}

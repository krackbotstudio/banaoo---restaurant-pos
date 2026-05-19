/** Thermal receipt layout: printable width (mm) + monospace column count. */

export type PaperWidthPresetId = "40" | "58" | "76" | "80" | "90" | "custom";

export interface PaperPreset {
  id: Exclude<PaperWidthPresetId, "custom">;
  label: string;
  mm: number;
  defaultColumns: number;
}

export const PAPER_PRESETS: PaperPreset[] = [
  { id: "40", label: "40 mm (compact)", mm: 40, defaultColumns: 22 },
  { id: "58", label: "58 mm (standard)", mm: 58, defaultColumns: 32 },
  { id: "76", label: "3 inch / 76 mm", mm: 76, defaultColumns: 46 },
  { id: "80", label: "80 mm (wide)", mm: 80, defaultColumns: 48 },
  { id: "90", label: "90 mm", mm: 90, defaultColumns: 54 },
];

export const COLUMN_MIN = 16;
export const COLUMN_MAX = 64;

export interface PrintLayout {
  preset: PaperWidthPresetId;
  paperWidthMm: number;
  columns: number;
}

export interface PaperLayoutFields {
  paperWidthPreset?: PaperWidthPresetId;
  paperWidthMm?: number;
  paperColumns?: number;
  /** Legacy storage — migrated on read */
  paperWidth?: 58 | 80;
}

const VALID_PRESET_IDS = new Set<string>(["40", "58", "76", "80", "90", "custom"]);

/** Coerce stored/localStorage values (e.g. numeric 58) to a valid preset id. */
export function coercePaperWidthPreset(value: unknown): PaperWidthPresetId | undefined {
  if (value === "custom") return "custom";
  const key = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (VALID_PRESET_IDS.has(key) && key !== "custom") {
    return key as Exclude<PaperWidthPresetId, "custom">;
  }
  return undefined;
}

export function presetById(id: PaperWidthPresetId): PaperPreset | undefined {
  if (id === "custom") return undefined;
  return PAPER_PRESETS.find((p) => p.id === id);
}

export function defaultColumnsForMm(mm: number): number {
  const preset = PAPER_PRESETS.find((p) => p.mm === mm);
  if (preset) return preset.defaultColumns;
  const base58 = PAPER_PRESETS.find((p) => p.id === "58")!;
  const base80 = PAPER_PRESETS.find((p) => p.id === "80")!;
  if (mm <= base58.mm) return base58.defaultColumns;
  if (mm >= base80.mm) {
    return Math.round(base80.defaultColumns * (mm / base80.mm));
  }
  return Math.round(
    base58.defaultColumns +
      ((base80.defaultColumns - base58.defaultColumns) * (mm - base58.mm)) /
        (base80.mm - base58.mm)
  );
}

export function clampColumns(n: number): number {
  return Math.min(COLUMN_MAX, Math.max(COLUMN_MIN, Math.round(n)));
}

/** Map mm to legacy 58|80 for native bridge payloads that only accept two values. */
export function legacyPaperWidthMm(mm: number): 58 | 80 {
  return mm <= 60 ? 58 : 80;
}

export function resolvePaperLayout(fields: PaperLayoutFields): PrintLayout {
  const coercedPreset = coercePaperWidthPreset(fields.paperWidthPreset);
  if (coercedPreset) {
    if (coercedPreset === "custom") {
      const mm =
        typeof fields.paperWidthMm === "number" && Number.isFinite(fields.paperWidthMm)
          ? fields.paperWidthMm
          : 58;
      const columns = clampColumns(
        fields.paperColumns ?? defaultColumnsForMm(mm)
      );
      return { preset: "custom", paperWidthMm: mm, columns };
    }
    const def = presetById(coercedPreset) ?? presetById("58")!;
    return {
      preset: coercedPreset,
      paperWidthMm:
        typeof fields.paperWidthMm === "number" && Number.isFinite(fields.paperWidthMm)
          ? fields.paperWidthMm
          : def.mm,
      columns: clampColumns(fields.paperColumns ?? def.defaultColumns),
    };
  }

  if (fields.paperWidthMm != null || fields.paperColumns != null) {
    const mm = fields.paperWidthMm ?? 58;
    return {
      preset: "custom",
      paperWidthMm: mm,
      columns: clampColumns(fields.paperColumns ?? defaultColumnsForMm(mm)),
    };
  }

  const legacy = fields.paperWidth === 80 ? 80 : 58;
  const def = presetById(legacy === 80 ? "80" : "58")!;
  return {
    preset: legacy === 80 ? "80" : "58",
    paperWidthMm: def.mm,
    columns: def.defaultColumns,
  };
}

export function paperLayoutToStorage(layout: PrintLayout): PaperLayoutFields {
  return {
    paperWidthPreset: layout.preset,
    paperWidthMm: layout.paperWidthMm,
    paperColumns: layout.columns,
    paperWidth: legacyPaperWidthMm(layout.paperWidthMm),
  };
}

export function adjustColumns(layout: PrintLayout, delta: number): PrintLayout {
  const next = {
    ...layout,
    preset: "custom" as const,
    columns: clampColumns(layout.columns + delta),
  };
  return next;
}

export function formatLayoutSummary(layout: PrintLayout): string {
  return `${layout.paperWidthMm} mm · ${layout.columns} columns`;
}

export function getPrintLayoutFromConfig(
  config: PaperLayoutFields & { fontSize?: number }
): { layout: PrintLayout; fontSize: number } {
  return {
    layout: resolvePaperLayout(config),
    fontSize: config.fontSize ?? 12,
  };
}

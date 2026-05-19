import { View, Text, Pressable, TextInput, StyleSheet } from "react-native";
import {
  PAPER_PRESETS,
  COLUMN_MIN,
  COLUMN_MAX,
  adjustColumns,
  formatLayoutSummary,
  resolvePaperLayout,
  paperLayoutToStorage,
  type PaperWidthPresetId,
} from "./paper-width";
import type { RolePrinterConfig } from "./printer-service";

interface PaperLayoutSectionProps {
  config: RolePrinterConfig;
  onUpdate: (patch: Partial<RolePrinterConfig>) => void;
  onCalibration?: () => void;
  calibrationDisabled?: boolean;
}

export function PaperLayoutSection({
  config,
  onUpdate,
  onCalibration,
  calibrationDisabled,
}: PaperLayoutSectionProps) {
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
    onUpdate(paperLayoutToStorage(next) as Partial<RolePrinterConfig>);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Paper width</Text>
      <View style={styles.chipRow}>
        {PAPER_PRESETS.map((p) => (
          <Pressable
            key={p.id}
            style={[styles.chip, config.paperWidthPreset === p.id && styles.chipActive]}
            onPress={() => applyPreset(p.id)}
          >
            <Text style={styles.chipText}>{p.mm}mm</Text>
          </Pressable>
        ))}
        <Pressable
          style={[styles.chip, config.paperWidthPreset === "custom" && styles.chipActive]}
          onPress={() => applyPreset("custom")}
        >
          <Text style={styles.chipText}>Custom</Text>
        </Pressable>
      </View>
      <Text style={styles.metaText}>{formatLayoutSummary(layout)}</Text>

      {isCustom ? (
        <View style={styles.customRow}>
          <View style={styles.customField}>
            <Text style={styles.metaText}>Width (mm)</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={String(config.paperWidthMm)}
              onChangeText={(text) => {
                const mm = Math.max(32, Math.min(120, Number(text) || 58));
                onUpdate({
                  paperWidthMm: mm,
                  paperWidth: mm <= 60 ? 58 : 80,
                });
              }}
            />
          </View>
          <View style={styles.customField}>
            <Text style={styles.metaText}>Columns</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={String(config.paperColumns)}
              onChangeText={(text) => {
                const columns = Math.max(
                  COLUMN_MIN,
                  Math.min(COLUMN_MAX, Number(text) || 32)
                );
                onUpdate({ paperColumns: columns });
              }}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.chipRow}>
        <Pressable style={styles.chip} onPress={() => bumpColumns(-2)}>
          <Text style={styles.chipText}>Narrower</Text>
        </Pressable>
        <Pressable style={styles.chip} onPress={() => bumpColumns(2)}>
          <Text style={styles.chipText}>Wider</Text>
        </Pressable>
        {onCalibration ? (
          <Pressable
            style={[styles.chip, styles.calibrationChip, calibrationDisabled && styles.chipDisabled]}
            onPress={onCalibration}
            disabled={calibrationDisabled}
          >
            <Text style={styles.chipText}>Calibrate</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginTop: 4 },
  label: { fontSize: 14, fontWeight: "600", color: "#111" },
  metaText: { fontSize: 12, color: "#666" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "#f8f8f8",
  },
  chipActive: { borderColor: "#2563eb", backgroundColor: "#dbeafe" },
  chipDisabled: { opacity: 0.5 },
  calibrationChip: { borderColor: "#7c3aed" },
  chipText: { fontSize: 12, fontWeight: "500", color: "#111" },
  customRow: { flexDirection: "row", gap: 10 },
  customField: { flex: 1, gap: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: "#fff",
  },
});

import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePrinterSettings } from "@/lib/use-printer-settings";
import {
  fetchPrinters,
  fetchCategoryMappings,
  fetchOutletPrintSettings,
  upsertOutletPrintSettings,
} from "@/lib/print/printer-repository";
import { migrateLegacyPrintersIfEmpty } from "@/lib/print/migrate-legacy";
import { buildLegacySettingsFromFleet } from "@/lib/print/legacy-adapter";
import type { FleetPrintContext } from "@/lib/print/print-service";
import type { OutletPrinterSettings } from "@/lib/use-printer-settings";

export function usePrintFleet(outletId: string | null | undefined) {
  const queryClient = useQueryClient();
  const legacyHook = usePrinterSettings(outletId);
  const [migrated, setMigrated] = useState(false);

  const printersQuery = useQuery({
    queryKey: ["print-fleet", "printers", outletId],
    queryFn: () => fetchPrinters(outletId!),
    enabled: !!outletId,
  });

  const mappingsQuery = useQuery({
    queryKey: ["print-fleet", "mappings", outletId],
    queryFn: () => fetchCategoryMappings(outletId!),
    enabled: !!outletId,
  });

  const settingsQuery = useQuery({
    queryKey: ["print-fleet", "settings", outletId],
    queryFn: () => fetchOutletPrintSettings(outletId!),
    enabled: !!outletId,
  });

  useEffect(() => {
    if (!outletId || migrated || printersQuery.isLoading) return;
    if ((printersQuery.data?.length ?? 0) > 0) {
      setMigrated(true);
      return;
    }
    void migrateLegacyPrintersIfEmpty(outletId, legacyHook.settings).then(() => {
      setMigrated(true);
      void queryClient.invalidateQueries({ queryKey: ["print-fleet"] });
    });
  }, [outletId, migrated, printersQuery.isLoading, printersQuery.data, legacyHook.settings, queryClient]);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["print-fleet"] });
  }, [queryClient, outletId]);

  const printers = printersQuery.data ?? [];
  const mappings = mappingsQuery.data ?? [];
  const settings = settingsQuery.data;

  const legacySettings: OutletPrinterSettings =
    printers.length > 0 ? buildLegacySettingsFromFleet(printers) : legacyHook.settings;

  const fleetContext: FleetPrintContext | null =
    outletId && settings
      ? { printers, mappings, settings }
      : null;

  return {
    printers,
    mappings,
    settings,
    fleetContext,
    legacySettings,
    isLoading: printersQuery.isLoading || settingsQuery.isLoading,
    invalidate,
    updateOutletSettings: async (patch: Parameters<typeof upsertOutletPrintSettings>[0]) => {
      await upsertOutletPrintSettings(patch);
      invalidate();
    },
    legacyHook,
  };
}

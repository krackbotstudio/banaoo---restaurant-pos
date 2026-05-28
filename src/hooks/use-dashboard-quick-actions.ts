import { useCallback, useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/api-base";
import { useAuth } from "@/lib/auth";
import { useFeatureGating } from "@/hooks/use-feature-gating";
import { useStaffPermissions } from "@/lib/use-staff-permissions";
import {
  MAX_QUICK_ACTIONS,
  QUICK_ACTION_CATALOG,
  type QuickActionDefinition,
  type QuickActionId,
  readStaffQuickActionIds,
  resolveQuickActionIds,
  writeStaffQuickActionIds,
  getQuickActionDefinition,
} from "@/lib/dashboard-quick-actions";
import { toast } from "sonner";

export function useDashboardQuickActions() {
  const { profile } = useAuth();
  const { permissions, loading: permissionsLoading } = useStaffPermissions();
  const { canAccess: canAccessFeature, loading: featureLoading } = useFeatureGating();
  const isOwner = !profile || profile.role === "owner";
  const isStaff = profile && profile.role !== "owner";

  const [savedIds, setSavedIds] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canAccessAction = useCallback(
    (action: QuickActionDefinition) => {
      if (action.ownerOnly && isStaff) return false;
      if (action.feature && !canAccessFeature(action.feature)) return false;
      if (permissions === null) return true;
      if (!permissions) return false;
      if (!action.permission) return true;
      return permissions.includes(action.permission);
    },
    [isStaff, permissions, canAccessFeature]
  );

  const accessibleCatalog = useMemo(
    () => QUICK_ACTION_CATALOG.filter(canAccessAction),
    [canAccessAction]
  );

  const fetchPrefs = useCallback(async () => {
    setLoading(true);
    try {
      if (isStaff) {
        setSavedIds(readStaffQuickActionIds());
        return;
      }
      const res = await fetch(apiUrl("/api/dashboard/quick-actions"), { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Stale/missing API — use defaults without alarming the user
        setSavedIds(null);
        return;
      }
      setSavedIds((data as { action_ids: string[] | null }).action_ids);
    } catch {
      setSavedIds(null);
    } finally {
      setLoading(false);
    }
  }, [isStaff]);

  useEffect(() => {
    if (permissionsLoading || featureLoading) return;
    void fetchPrefs();
  }, [fetchPrefs, permissionsLoading, featureLoading]);

  const activeIds = useMemo(
    () => resolveQuickActionIds(savedIds, canAccessAction),
    [savedIds, canAccessAction]
  );

  const activeActions = useMemo(
    () =>
      activeIds
        .map((id) => getQuickActionDefinition(id))
        .filter((a): a is QuickActionDefinition => !!a),
    [activeIds]
  );

  const saveActions = async (ids: QuickActionId[]) => {
    if (ids.length < 1 || ids.length > MAX_QUICK_ACTIONS) {
      toast.error(`Choose between 1 and ${MAX_QUICK_ACTIONS} shortcuts`);
      return false;
    }
    const allowed = ids.every((id) => {
      const def = getQuickActionDefinition(id);
      return def && canAccessAction(def);
    });
    if (!allowed) {
      toast.error("One or more shortcuts are not available for your account");
      return false;
    }

    setSaving(true);
    try {
      if (isStaff) {
        writeStaffQuickActionIds(ids);
        setSavedIds(ids);
        toast.success("Shortcuts saved on this device");
        return true;
      }
      const res = await fetch(apiUrl("/api/dashboard/quick-actions"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action_ids: ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to save");
      setSavedIds((data as { action_ids: string[] }).action_ids);
      toast.success("Quick actions updated");
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    loading: loading || permissionsLoading || featureLoading,
    saving,
    activeActions,
    activeIds,
    accessibleCatalog,
    saveActions,
    isOwner,
  };
}

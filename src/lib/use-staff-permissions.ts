import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/**
 * Default page permissions per staff role.
 * Used when a staff member's page_permissions is NULL (not yet customised).
 */
export const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  manager:  ["dashboard", "menu", "orders", "order-history", "customers", "analytics", "inventory", "kitchen"],
  chef:     ["orders", "kitchen", "menu"],
  waiter:   ["orders", "menu"],
  cashier:  ["orders", "order-history", "customers", "menu"],
  staff:    ["orders", "menu"],
};

/**
 * All modules that can be toggled.
 * The key matches the URL segment used in AppSidebar nav items.
 */
export const ALL_MODULES = [
  { key: "dashboard",    label: "Dashboard" },
  { key: "outlets",      label: "Outlets" },
  { key: "menu",         label: "Menu" },
  { key: "orders",       label: "Orders" },
  { key: "order-history",label: "Order History" },
  { key: "customers",    label: "Customers" },
  { key: "analytics",    label: "Analytics" },
  { key: "inventory",    label: "Inventory" },
  { key: "kitchen",      label: "Kitchen" },
  { key: "staff",        label: "Staff" },
  { key: "integrations", label: "Integrations" },
  { key: "settings",     label: "Settings" },
] as const;

export type ModuleKey = typeof ALL_MODULES[number]["key"];

interface StaffPermissionsResult {
  /** null = owner, no restrictions. string[] = allowed page keys for staff. */
  permissions: string[] | null;
  loading: boolean;
}

/**
 * Returns the page permissions for the currently logged-in user.
 *
 * - If role === "owner"  → returns null (no restriction, show everything)
 * - If role is staff     → looks up staff_members record by email and returns
 *                          page_permissions (or role defaults if not configured)
 */
export function useStaffPermissions(): StaffPermissionsResult {
  const { profile, user } = useAuth();
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile || !user) {
      setLoading(false);
      return;
    }

    // Owners always see everything
    if (profile.role === "owner") {
      setPermissions(null);
      setLoading(false);
      return;
    }

    // For staff roles, look up their staff_member record by email
    const email = user.email;
    if (!email) {
      // No email — fall back to role defaults
      const defaults = ROLE_DEFAULT_PERMISSIONS[profile.role] ?? ["orders", "menu"];
      setPermissions(defaults);
      setLoading(false);
      return;
    }

    supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("staff_members" as any)
      .select("role, page_permissions")
      .eq("system_email", email)   // system_email = "username@banaoo-staff.app" (what staff log in with)
      .maybeSingle()
      .then(({ data }: { data: any }) => {
        if (data) {
          // Use explicit permissions if set, otherwise fall back to role defaults
          const perms: string[] | null = data.page_permissions;
          if (perms && perms.length > 0) {
            setPermissions(perms);
          } else {
            const role = data.role as string;
            setPermissions(ROLE_DEFAULT_PERMISSIONS[role] ?? ["orders", "menu"]);
          }
        } else {
          // No staff_members record — fall back to profile role defaults
          setPermissions(ROLE_DEFAULT_PERMISSIONS[profile.role] ?? ["orders", "menu"]);
        }
        setLoading(false);
      });
  }, [profile, user]);

  return { permissions, loading };
}

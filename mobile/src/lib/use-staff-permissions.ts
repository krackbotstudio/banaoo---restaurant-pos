import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useAuth } from "../context/AuthContext";

export const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  manager: ["dashboard", "menu", "orders", "order-history", "customers", "analytics", "kitchen"],
  chef: ["orders", "kitchen", "menu"],
  waiter: ["orders", "menu"],
  cashier: ["orders", "order-history", "customers", "menu"],
  staff: ["orders", "menu"],
};

interface StaffPermissionsResult {
  permissions: string[] | null;
  loading: boolean;
}

export function useStaffPermissions(): StaffPermissionsResult {
  const { user, profile } = useAuth();
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!profile || !user) {
        if (mounted) {
          setPermissions(null);
          setLoading(false);
        }
        return;
      }

      if (profile.role === "owner") {
        if (mounted) {
          setPermissions(null);
          setLoading(false);
        }
        return;
      }

      const email = user.email;
      if (!email) {
        if (mounted) {
          setPermissions(ROLE_DEFAULT_PERMISSIONS[profile.role] ?? ["orders", "menu"]);
          setLoading(false);
        }
        return;
      }

      const { data } = await supabase
        .from("staff_members")
        .select("role, page_permissions")
        .eq("system_email", email)
        .maybeSingle();

      if (!mounted) return;

      if (data?.page_permissions && data.page_permissions.length > 0) {
        setPermissions(data.page_permissions as string[]);
      } else {
        const role = (data?.role as string) || profile.role;
        setPermissions(ROLE_DEFAULT_PERMISSIONS[role] ?? ["orders", "menu"]);
      }
      setLoading(false);
    };

    setLoading(true);
    void load();
    return () => {
      mounted = false;
    };
  }, [user?.id, user?.email, profile?.role]);

  return { permissions, loading };
}

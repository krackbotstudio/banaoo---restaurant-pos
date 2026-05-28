import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { API_URL } from "@/lib/api-url";

export type CmsRole = "super_admin" | "support" | "billing" | "marketing";

export interface CmsAdmin {
  id: string;
  email: string;
  full_name?: string;
  role: CmsRole;
  source: "admin_users" | "legacy_profile";
  user_id?: string;
}

interface CmsAuthContextType {
  admin: CmsAdmin | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const CmsAuthContext = createContext<CmsAuthContextType | undefined>(undefined);

export function CmsAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<CmsAdmin | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/cms/me`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setAdmin(data.admin ?? null);
      } else {
        setAdmin(null);
      }
    } catch {
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_URL}/api/cms/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      setAdmin(data.admin);
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error("Login failed") };
    }
  };

  const signOut = async () => {
    try {
      await fetch(`${API_URL}/api/cms/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setAdmin(null);
    }
  };

  return (
    <CmsAuthContext.Provider value={{ admin, loading, signIn, signOut, refresh }}>
      {children}
    </CmsAuthContext.Provider>
  );
}

export function useCmsAuth() {
  const ctx = useContext(CmsAuthContext);
  if (!ctx) throw new Error("useCmsAuth must be used within CmsAuthProvider");
  return ctx;
}

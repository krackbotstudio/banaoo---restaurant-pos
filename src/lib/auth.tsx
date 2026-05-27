import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { API_URL } from "@/lib/api-url";

/** After Passport auth, minted JWT aligns auth.uid() with public.users.id for Supabase RLS. */
async function syncSupabaseSession(): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/auth/supabase-token`, { credentials: "include" });
    if (res.status === 503) {
      console.warn(
        "Server missing SUPABASE_JWT_SECRET — Supabase row-level security will block owner actions until it is set."
      );
      return;
    }
    if (!res.ok) return;
    const { access_token } = await res.json();
    if (!access_token) return;
    await supabase.auth.setSession({ access_token, refresh_token: access_token });
  } catch (e) {
    console.warn("Supabase session sync failed:", e);
  }
}

interface User {
  id: string;
  email: string;
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  role: "owner" | "manager" | "kitchen" | "service";
  phone: string | null;
  business_type: string | null;
  onboarding_completed: boolean;
  ordering_slug: string | null;
  brand_name: string | null;
  logo_url: string | null;
  brand_color: string | null;
  app_theme: string | null;
  account_status: "pending" | "approved" | "rejected" | null;
  is_admin: boolean | null;
  upi_vpa?: string | null;
  upi_display_name?: string | null;
  upi_qr_url?: string | null;
  online_payments_enabled?: boolean | null;
  terms_accepted_at?: string | null;
  terms_version?: string | null;
}

interface AuthContextType {
  user: User | null;
  session: any | null; // Kept for compatibility, but we use sessions now
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    phone: string,
    extras?: { terms_version?: string }
  ) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
  getImageUrl: (url: string | null) => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/me`, { credentials: "include" });
        if (res.status === 401) {
          await supabase.auth.signOut();
          if (!cancelled) {
            setUser(null);
            setProfile(null);
          }
          return;
        }
        if (!res.ok) throw new Error("Failed to check authentication");
        const data = await res.json();
        if (!data) {
          await supabase.auth.signOut();
          if (!cancelled) {
            setUser(null);
            setProfile(null);
          }
          return;
        }
        await syncSupabaseSession();
        if (!cancelled) {
          setUser(data.user);
          setProfile(data.profile);
        }
      } catch {
        await supabase.auth.signOut();
        if (!cancelled) {
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshProfile = async () => {
    if (!user) return;
    setProfileLoading(true);
    try {
      await syncSupabaseSession();
      const res = await fetch(`${API_URL}/auth/me`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
      }
    } catch (err) {
      console.error("Error refreshing profile:", err);
    } finally {
      setProfileLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");

      setUser(data.user);
      await syncSupabaseSession();
      const meRes = await fetch(`${API_URL}/auth/me`, { credentials: "include" });
      if (meRes.ok) {
        const meData = await meRes.json();
        setProfile(meData.profile);
      }
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    phone: string,
    extras?: { terms_version?: string }
  ) => {
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          fullName,
          phone,
          terms_version: extras?.terms_version,
        }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");

      setUser(data.user);
      await syncSupabaseSession();
      const meRes = await fetch(`${API_URL}/auth/me`, { credentials: "include" });
      if (meRes.ok) {
        const meData = await meRes.json();
        setProfile(meData.profile);
      }
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  const signInWithGoogle = async () => {
    // This function is now handled directly in Auth.tsx
    // Keeping for backwards compatibility
    return { error: null };
  };

  const signOut = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const resetPassword = async (email: string) => {
    // Placeholder for reset password logic in Express
    return { error: new Error("Reset password not implemented yet in custom backend") };
  };

  const updatePassword = async (password: string) => {
    try {
      const res = await fetch(`${API_URL}/auth/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update password");
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  const getImageUrl = (url: string | null | undefined): string => {
    if (!url) return "";
    if (url.startsWith("http") || url.startsWith("data:")) return url;
    return `${API_URL}${url}`;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session: user ? { user } : null,
        profile,
        loading,
        profileLoading,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        resetPassword,
        refreshProfile,
        updatePassword,
        getImageUrl,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { API_URL } from "../lib/config";
import { storage } from "../lib/storage";
import { supabase } from "../lib/supabase";

const AUTH_SNAPSHOT_KEY = "mobile_auth_snapshot_v1";
const NATIVE_AUTH_CALLBACK_PATH = "auth/callback";

WebBrowser.maybeCompleteAuthSession();

export interface User {
  id: string;
  email: string;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  role: "owner" | "manager" | "kitchen" | "service";
  is_admin?: boolean;
  onboarding_completed?: boolean;
  account_status?: "pending" | "approved" | "rejected" | null;
}

interface AuthSnapshot {
  user: User | null;
  profile: Profile | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    phone: string
  ) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function syncSupabaseSession() {
  if (!API_URL) return;
  try {
    const res = await fetch(`${API_URL}/auth/supabase-token`, {
      method: "GET",
      credentials: "include",
    });
    if (!res.ok) return;
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) return;
    await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.access_token,
    });
  } catch {
    // Non-fatal on mobile bootstrap.
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      const snapshot = await storage.getItem<AuthSnapshot>(AUTH_SNAPSHOT_KEY);
      if (active && snapshot) {
        setUser(snapshot.user);
        setProfile(snapshot.profile);
      }

      if (!API_URL) {
        if (active) setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/auth/me`, { credentials: "include" });
        if (res.ok) {
          const data = (await res.json()) as { user: User; profile: Profile };
          await syncSupabaseSession();
          if (active) {
            setUser(data.user);
            setProfile(data.profile);
            await storage.setItem(AUTH_SNAPSHOT_KEY, {
              user: data.user,
              profile: data.profile,
            });
          }
        }
      } catch {
        // Keep offline snapshot if available.
      } finally {
        if (active) setLoading(false);
      }
    };

    void bootstrap();
    return () => {
      active = false;
    };
  }, []);

  const refreshProfile = async () => {
    if (!API_URL) return;
    const res = await fetch(`${API_URL}/auth/me`, { credentials: "include" });
    if (!res.ok) return;
    const data = (await res.json()) as { user: User; profile: Profile };
    await syncSupabaseSession();
    setUser(data.user);
    setProfile(data.profile);
    await storage.setItem(AUTH_SNAPSHOT_KEY, { user: data.user, profile: data.profile });
  };

  const signIn: AuthContextType["signIn"] = async (email, password) => {
    try {
      if (!API_URL) throw new Error("Missing EXPO_PUBLIC_API_URL");
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");

      await syncSupabaseSession();
      setUser(data.user as User);
      await refreshProfile();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  };

  const signUp: AuthContextType["signUp"] = async (email, password, fullName, phone) => {
    try {
      if (!API_URL) throw new Error("Missing EXPO_PUBLIC_API_URL");
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, fullName, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");

      await syncSupabaseSession();
      setUser(data.user as User);
      await refreshProfile();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  };

  const signInWithGoogle: AuthContextType["signInWithGoogle"] = async () => {
    try {
      if (!API_URL) throw new Error("Missing EXPO_PUBLIC_API_URL");
      const redirectUri = Linking.createURL(NATIVE_AUTH_CALLBACK_PATH, { scheme: "banaoo" });
      const authUrl = `${API_URL}/auth/google?redirect_uri=${encodeURIComponent(redirectUri)}`;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (result.type !== "success") {
        return { error: new Error("Google sign-in was cancelled") };
      }

      await refreshProfile();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  };

  const signOut = async () => {
    try {
      if (API_URL) {
        await fetch(`${API_URL}/auth/logout`, {
          method: "POST",
          credentials: "include",
        });
      }
    } finally {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      await storage.removeItem(AUTH_SNAPSHOT_KEY);
    }
  };

  const value = useMemo(
    () => ({ user, profile, loading, signIn, signUp, signInWithGoogle, signOut, refreshProfile }),
    [user, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

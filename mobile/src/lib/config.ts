import Constants from "expo-constants";

function cleanBaseUrl(input: string | undefined | null) {
  return (input ?? "").trim().replace(/\/+$/, "");
}

const appExtra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;

const apiFromEnv = cleanBaseUrl(process.env.EXPO_PUBLIC_API_URL);
const apiFromExtra = cleanBaseUrl(typeof appExtra.apiUrl === "string" ? appExtra.apiUrl : "");
const webFromEnv = cleanBaseUrl(process.env.EXPO_PUBLIC_WEBAPP_URL);
const webFromExtra = cleanBaseUrl(typeof appExtra.webappUrl === "string" ? appExtra.webappUrl : "");

// Hard fallback so release APK remains usable even if EXPO_PUBLIC vars are not injected.
export const API_URL = apiFromEnv || apiFromExtra || "https://flazee.com";
export const WEBAPP_URL = webFromEnv || webFromExtra || API_URL;
export const SUPABASE_URL = cleanBaseUrl(process.env.EXPO_PUBLIC_SUPABASE_URL);
export const SUPABASE_PUBLISHABLE_KEY = (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim();

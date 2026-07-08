function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function resolveApiUrl(): string {
  const fromEnv = normalizeUrl(import.meta.env.VITE_API_URL ?? "");
  if (!fromEnv) return "";

  if (typeof window !== "undefined") {
    const currentHost = window.location.hostname;
    // Local frontend should default to local backend to avoid CORS with production API.
    if (isLocalHost(currentHost) && /^https?:\/\/banaoo\.in$/i.test(fromEnv)) {
      return "http://localhost:5000";
    }
  }

  return fromEnv;
}

export const API_URL = resolveApiUrl();

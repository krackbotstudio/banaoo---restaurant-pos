import { API_URL } from "@/lib/api-url";

/**
 * Base URL for API calls. In local dev we use relative `/api` so Vite proxies to the backend.
 * This avoids CORS issues and matches how auth routes are often called.
 */
export function getApiBase(): string {
  if (typeof window !== "undefined" && import.meta.env.DEV) {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "";
    }
  }
  return API_URL;
}

export function apiUrl(path: string): string {
  const base = getApiBase();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

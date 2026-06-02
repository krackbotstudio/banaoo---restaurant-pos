import { API_URL } from "@/lib/api-url";

/** Resolve stored upload paths (/uploads/...) to a URL the browser can load */
export function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("data:")) return url;

  let path = url;
  if (!path.startsWith("/")) {
    path = `/uploads/${path.replace(/^uploads\//, "")}`;
  }

  if (typeof window !== "undefined") {
    return path;
  }
  return API_URL ? `${API_URL}${path}` : path;
}

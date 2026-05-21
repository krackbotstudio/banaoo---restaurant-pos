const API_URL = import.meta.env.VITE_API_URL ?? "";

/** Resolve stored upload paths (/uploads/...) to full URLs for display */
export function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  return `${API_URL}${url}`;
}

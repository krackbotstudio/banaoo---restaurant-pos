export type OutletOperationMode = "standard" | "self_service";

export function isSelfServiceMode(mode?: string | null): boolean {
  return mode === "self_service";
}

/** Human-readable banner for aggregator / online orders on slips and UI. */
export function formatOrderSourceLabel(source?: string | null): string | null {
  if (!source || source === "pos") return null;
  const map: Record<string, string> = {
    zomato: "ZOMATO",
    swiggy: "SWIGGY",
    customer_app: "ONLINE ORDER",
    online: "ONLINE ORDER",
  };
  return map[source] ?? source.replace(/_/g, " ").toUpperCase();
}

export function isOnlineOrderSource(source?: string | null): boolean {
  return !!source && source !== "pos";
}

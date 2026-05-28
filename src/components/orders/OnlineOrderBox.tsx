import { cn } from "@/lib/utils";
import { Box, User } from "lucide-react";
import { PlatformBadge } from "@/components/integrations";

type OrderStatus = "pending" | "preparing" | "ready" | "completed" | "paid" | "cancelled";

interface OnlineOrderBoxProps {
  orderNumber: string;
  source: string;
  customerName?: string | null;
  itemCount: number;
  total: number;
  status: OrderStatus;
  onClick?: () => void;
  className?: string;
}

const statusStyles: Record<string, { lid: string; body: string; badge: string; label: string }> = {
  pending: { lid: "from-amber-200 to-amber-300", body: "from-amber-50 to-amber-100", badge: "bg-yellow-500", label: "New" },
  preparing: { lid: "from-blue-200 to-blue-300", body: "from-blue-50 to-blue-100", badge: "bg-blue-500", label: "Preparing" },
  ready: { lid: "from-green-200 to-green-300", body: "from-green-50 to-green-100", badge: "bg-green-500", label: "Ready" },
  completed: { lid: "from-purple-200 to-purple-300", body: "from-purple-50 to-purple-100", badge: "bg-purple-500", label: "Awaiting Pay" },
  paid: { lid: "from-emerald-200 to-emerald-300", body: "from-emerald-50 to-emerald-100", badge: "bg-emerald-500", label: "Paid" },
  cancelled: { lid: "from-red-200 to-red-300", body: "from-red-50 to-red-100", badge: "bg-red-400", label: "Cancelled" },
};

const sourceAccent: Record<string, string> = {
  zomato: "border-l-red-500",
  swiggy: "border-l-orange-500",
  pos: "border-l-primary",
};

export function OnlineOrderBox({
  orderNumber,
  source,
  customerName,
  itemCount,
  total,
  status,
  onClick,
  className,
}: OnlineOrderBoxProps) {
  const style = statusStyles[status] ?? statusStyles.pending;
  const accent = sourceAccent[source] ?? "border-l-muted-foreground";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex flex-col items-center gap-3 rounded-2xl border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 border-l-4 text-left w-full",
        accent,
        className
      )}
    >
      <div className="relative flex h-28 w-24 items-end justify-center">
        {/* Box lid */}
        <div
          className={cn(
            "absolute top-2 h-5 w-[88px] rounded-sm bg-gradient-to-b border border-black/10 shadow-sm origin-bottom transition-transform group-hover:-rotate-6",
            style.lid
          )}
        />
        {/* Box body */}
        <div
          className={cn(
            "absolute bottom-0 h-[72px] w-20 rounded-md bg-gradient-to-b border-2 border-black/10 shadow-inner flex items-center justify-center",
            style.body
          )}
        >
          <Box className="h-8 w-8 text-foreground/30" />
        </div>
        {(status === "pending" || status === "preparing") && (
          <span className="absolute top-0 right-0 flex h-2.5 w-2.5">
            <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", style.badge)} />
            <span className={cn("relative inline-flex rounded-full h-2.5 w-2.5", style.badge)} />
          </span>
        )}
      </div>

      <div className="w-full space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold text-white shrink-0", style.badge)}>
            {style.label}
          </span>
          {source !== "pos" && <PlatformBadge source={source} />}
        </div>
        <p className="text-sm font-bold truncate">#{orderNumber}</p>
        {customerName && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
            <User className="h-3 w-3 shrink-0" />
            {customerName}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{itemCount} items · ₹{total}</p>
      </div>
    </button>
  );
}

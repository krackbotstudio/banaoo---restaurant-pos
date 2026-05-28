import { cn } from "@/lib/utils";
import { Plus, ShoppingBag } from "lucide-react";

type OrderStatus = "pending" | "preparing" | "ready" | "completed" | "paid" | "cancelled";

interface TakeawayBagCardProps {
  orderNumber?: string;
  itemCount?: number;
  total?: number;
  status?: OrderStatus;
  isNew?: boolean;
  onClick?: () => void;
  className?: string;
}

const statusStyles: Record<string, { ring: string; badge: string; label: string }> = {
  pending: { ring: "ring-yellow-500/40", badge: "bg-yellow-500", label: "Pending" },
  preparing: { ring: "ring-blue-500/40", badge: "bg-blue-500", label: "Preparing" },
  ready: { ring: "ring-green-500/40", badge: "bg-green-500", label: "Ready" },
  completed: { ring: "ring-purple-500/40", badge: "bg-purple-500", label: "Awaiting Pay" },
  paid: { ring: "ring-emerald-500/40", badge: "bg-emerald-500", label: "Paid" },
  cancelled: { ring: "ring-red-500/30", badge: "bg-red-400", label: "Cancelled" },
};

export function TakeawayBagCard({
  orderNumber,
  itemCount = 0,
  total = 0,
  status = "pending",
  isNew = false,
  onClick,
  className,
}: TakeawayBagCardProps) {
  const style = statusStyles[status] ?? statusStyles.pending;

  if (isNew) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "group flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-orange-300/60 bg-orange-50/30 p-6 transition-all hover:border-orange-400 hover:bg-orange-50/60 hover:shadow-md",
          className
        )}
      >
        <div className="relative flex h-28 w-24 items-end justify-center">
          <div className="absolute bottom-0 h-20 w-20 rounded-b-3xl rounded-t-lg border-2 border-dashed border-orange-300/70 bg-background/80 group-hover:border-orange-400" />
          <div className="absolute top-6 h-3 w-14 rounded-full border-2 border-dashed border-orange-300/70 bg-background/80 group-hover:border-orange-400" />
          <Plus className="relative z-10 mb-8 h-8 w-8 text-orange-500" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-orange-600">New Takeaway</p>
          <p className="text-xs text-muted-foreground mt-0.5">Tap to start packing</p>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex flex-col items-center gap-3 rounded-2xl border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 ring-2",
        style.ring,
        className
      )}
    >
      <div className="relative flex h-28 w-24 items-end justify-center">
        {/* Bag body */}
        <div className="absolute bottom-0 h-20 w-20 rounded-b-3xl rounded-t-lg bg-gradient-to-b from-orange-100 to-orange-200 border-2 border-orange-300/80 shadow-inner" />
        {/* Handles */}
        <div className="absolute top-5 h-3 w-12 rounded-full border-2 border-orange-400/80 bg-transparent" />
        {/* Icon overlay */}
        <ShoppingBag className="relative z-10 mb-6 h-7 w-7 text-orange-600/80" />
        {/* Status dot */}
        {(status === "pending" || status === "preparing" || status === "ready") && (
          <span className="absolute top-1 right-0 flex h-2.5 w-2.5">
            <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", style.badge)} />
            <span className={cn("relative inline-flex rounded-full h-2.5 w-2.5", style.badge)} />
          </span>
        )}
      </div>

      <div className="text-center space-y-1 w-full">
        <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white", style.badge)}>
          {style.label}
        </span>
        <p className="text-sm font-bold truncate">#{orderNumber}</p>
        <p className="text-xs text-muted-foreground">{itemCount} items · ₹{total}</p>
      </div>
    </button>
  );
}

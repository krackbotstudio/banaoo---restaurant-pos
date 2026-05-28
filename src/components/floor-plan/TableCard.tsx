import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Lock } from "lucide-react";

type OrderStatus = "pending" | "preparing" | "ready" | "completed";

interface TableCardProps {
  id: string;
  tableNumber: string;
  seats: number;
  status: "available" | "occupied" | "reserved";
  customerName?: string | null;
  reservedTime?: string | null;
  partySize?: number | null;
  isSelected?: boolean;
  /** Live running order status for this table, if any */
  liveOrderStatus?: OrderStatus;
  /** Live order number to display */
  liveOrderNumber?: string;
  onClick?: () => void;
  onLiveOrderClick?: () => void;
  className?: string;
}

const liveOrderColors: Record<OrderStatus, { border: string; bg: string; badge: string; dot: string; label: string }> = {
  pending:   { border: "border-yellow-500", bg: "bg-yellow-500/10", badge: "bg-yellow-500 text-white",    dot: "bg-yellow-500",    label: "Pending" },
  preparing: { border: "border-blue-500",   bg: "bg-blue-500/10",   badge: "bg-blue-500 text-white",      dot: "bg-blue-500",      label: "Preparing" },
  ready:     { border: "border-green-500",  bg: "bg-green-500/10",  badge: "bg-green-500 text-white",     dot: "bg-green-500",     label: "Ready" },
  completed: { border: "border-purple-500", bg: "bg-purple-500/10", badge: "bg-purple-500 text-white",    dot: "bg-purple-500",    label: "Awaiting Payment" },
};

export function TableCard({
  tableNumber,
  seats,
  status,
  customerName,
  reservedTime,
  partySize,
  isSelected,
  liveOrderStatus,
  liveOrderNumber,
  onClick,
  onLiveOrderClick,
  className,
}: TableCardProps) {
  const hasLiveOrder = !!liveOrderStatus;
  const handleClick = hasLiveOrder && onLiveOrderClick ? onLiveOrderClick : onClick;
  const live = liveOrderStatus ? liveOrderColors[liveOrderStatus] : null;

  const staticStyles = {
    available: "border-dashed border-muted-foreground/30 bg-background",
    occupied:  "border-solid border-green-500 bg-green-500/10",
    reserved:  "border-solid border-orange-400 bg-orange-400/10",
  };

  const borderStyle = hasLiveOrder
    ? `border-solid ${live!.border} ${live!.bg}`
    : staticStyles[status];

  const badgeStyle = hasLiveOrder
    ? live!.badge
    : status === "occupied"
      ? "bg-green-500 text-white"
      : status === "reserved"
        ? "bg-orange-400 text-white"
        : "bg-muted text-muted-foreground";

  // Render chair dots
  const renderChairs = () => {
    const chairCount = Math.min(seats, 8);
    const topChairs = Math.ceil(chairCount / 2);
    const bottomChairs = Math.floor(chairCount / 2);

    const chairDot = (key: string) => (
      <div
        key={key}
        className={cn(
          "w-2.5 h-2.5 rounded-full transition-colors",
          isSelected ? "bg-primary" : hasLiveOrder ? live!.dot + " opacity-70" : "bg-muted-foreground/40"
        )}
      />
    );

    return (
      <>
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex gap-2">
          {Array.from({ length: topChairs }).map((_, i) => chairDot(`top-${i}`))}
        </div>
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {Array.from({ length: bottomChairs }).map((_, i) => chairDot(`bottom-${i}`))}
        </div>
      </>
    );
  };

  return (
    <div
      onClick={handleClick}
      title={
        hasLiveOrder
          ? onLiveOrderClick
            ? `Open ${live!.label} order on Table ${tableNumber}`
            : `Table ${tableNumber} has a live ${live!.label} order`
          : undefined
      }
      className={cn(
        "relative transition-all py-6 px-4",
        handleClick ? "cursor-pointer" : hasLiveOrder ? "cursor-not-allowed opacity-80" : "cursor-pointer",
        className
      )}
    >
      {renderChairs()}

      <div
        className={cn(
          "relative rounded-xl border-2 p-4 min-h-[100px] flex flex-col items-center justify-center transition-all",
          borderStyle,
          isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background border-primary shadow-lg",
          onLiveOrderClick && hasLiveOrder && "hover:ring-2 hover:ring-primary/40 hover:shadow-md",
          !hasLiveOrder && "hover:shadow-md"
        )}
      >
        {/* Lock + pulsing dot for live orders */}
        {hasLiveOrder && (
          <>
            <span className="absolute top-2 right-2 flex h-2 w-2">
              <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", live!.dot)} />
              <span className={cn("relative inline-flex rounded-full h-2 w-2", live!.dot)} />
            </span>
            {!onLiveOrderClick && (
              <Lock className="absolute bottom-2 right-2 h-3 w-3 text-muted-foreground/50" />
            )}
          </>
        )}

        {/* Table number badge */}
        <div
          className={cn(
            "absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold",
            badgeStyle
          )}
        >
          {tableNumber}
        </div>

        {/* Content */}
        {hasLiveOrder ? (
          <div className="text-center space-y-0.5">
            <p className={cn("font-semibold text-xs", live!.dot.replace("bg-", "text-"))}>
              {live!.label}
            </p>
            {liveOrderNumber && (
              <p className="text-[10px] text-muted-foreground leading-none">
                #{liveOrderNumber}
              </p>
            )}
          </div>
        ) : status === "available" ? (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{seats} seats</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Free</p>
          </div>
        ) : (
          <div className="text-center">
            {customerName && (
              <p className={cn(
                "font-medium text-sm truncate max-w-[100px]",
                status === "occupied" ? "text-green-700 dark:text-green-400" : "text-orange-700 dark:text-orange-400"
              )}>
                {customerName}
              </p>
            )}
            {reservedTime && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(new Date(reservedTime), "h:mm a")}
              </p>
            )}
            {partySize && (
              <p className="text-xs text-muted-foreground">
                {partySize} guests
              </p>
            )}
            {!customerName && !reservedTime && (
              <p className="text-sm text-muted-foreground">
                {status === "occupied" ? "Checked-in" : "Reserved"}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

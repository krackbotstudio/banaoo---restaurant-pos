import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface TableCardProps {
  id: string;
  tableNumber: string;
  seats: number;
  status: "available" | "occupied" | "reserved";
  customerName?: string | null;
  reservedTime?: string | null;
  partySize?: number | null;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function TableCard({
  tableNumber,
  seats,
  status,
  customerName,
  reservedTime,
  partySize,
  isSelected,
  onClick,
  className,
}: TableCardProps) {
  const statusStyles = {
    available: "border-dashed border-muted-foreground/30 bg-background",
    occupied: "border-solid border-green-500 bg-green-500/10",
    reserved: "border-solid border-orange-400 bg-orange-400/10",
  };

  const statusLabels = {
    available: "Free",
    occupied: "Checked-in",
    reserved: "Reserved",
  };

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
          isSelected ? "bg-primary" : "bg-muted-foreground/40"
        )}
      />
    );

    return (
      <>
        {/* Top chairs */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex gap-2">
          {Array.from({ length: topChairs }).map((_, i) => chairDot(`top-${i}`))}
        </div>
        {/* Bottom chairs */}
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {Array.from({ length: bottomChairs }).map((_, i) => chairDot(`bottom-${i}`))}
        </div>
      </>
    );
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative cursor-pointer transition-all py-6 px-4",
        className
      )}
    >
      {renderChairs()}
      
      <div
        className={cn(
          "relative rounded-xl border-2 p-4 min-h-[100px] flex flex-col items-center justify-center transition-all",
          statusStyles[status],
          isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background border-primary shadow-lg",
          "hover:shadow-md"
        )}
      >
        {/* Table number badge */}
        <div
          className={cn(
            "absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold",
            status === "available" && "bg-muted text-muted-foreground",
            status === "occupied" && "bg-green-500 text-white",
            status === "reserved" && "bg-orange-400 text-white"
          )}
        >
          {tableNumber}
        </div>

        {/* Content based on status */}
        {status === "available" ? (
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
              <p className="text-sm text-muted-foreground">{statusLabels[status]}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

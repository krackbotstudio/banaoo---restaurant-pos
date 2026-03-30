import { cn } from "@/lib/utils";

interface TableElementProps {
  id: string;
  tableNumber: string;
  shape: "square" | "round" | "rectangle";
  seats: number;
  status: "available" | "occupied" | "reserved";
  isSelected?: boolean;
  isEditing?: boolean;
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  style?: React.CSSProperties;
  className?: string;
}

export function TableElement({
  tableNumber,
  shape,
  seats,
  status,
  isSelected,
  isEditing,
  onClick,
  onDragStart,
  onDragEnd,
  style,
  className,
}: TableElementProps) {
  const statusColors = {
    available: "bg-green-500/20 border-green-500/50 hover:border-green-500",
    occupied: "bg-orange-500/20 border-orange-500/50 hover:border-orange-500",
    reserved: "bg-muted border-muted-foreground/30 hover:border-muted-foreground/50",
  };

  const statusTextColors = {
    available: "text-green-600 dark:text-green-400",
    occupied: "text-orange-600 dark:text-orange-400",
    reserved: "text-muted-foreground",
  };

  const shapeClasses = {
    square: "rounded-lg aspect-square",
    round: "rounded-full aspect-square",
    rectangle: "rounded-lg",
  };

  // Generate chair positions based on shape and seat count
  const renderChairs = () => {
    const chairClass = cn(
      "absolute w-2 h-2 rounded-full transition-colors",
      isSelected ? "bg-primary" : "bg-muted-foreground/40"
    );

    if (shape === "round") {
      // Distribute chairs around the circle
      return Array.from({ length: Math.min(seats, 8) }).map((_, i) => {
        const angle = (i * 360) / Math.min(seats, 8) - 90;
        const radians = (angle * Math.PI) / 180;
        const radius = 52;
        const x = 50 + radius * Math.cos(radians);
        const y = 50 + radius * Math.sin(radians);
        return (
          <div
            key={i}
            className={chairClass}
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transform: "translate(-50%, -50%)",
            }}
          />
        );
      });
    }

    // Square or rectangle chairs
    const positions: { top?: string; bottom?: string; left?: string; right?: string; transform: string }[] = [];
    const seatsPerSide = Math.ceil(seats / 4);

    // Top chairs
    for (let i = 0; i < seatsPerSide && positions.length < seats; i++) {
      positions.push({
        top: "-8px",
        left: `${((i + 1) * 100) / (seatsPerSide + 1)}%`,
        transform: "translateX(-50%)",
      });
    }
    // Bottom chairs
    for (let i = 0; i < seatsPerSide && positions.length < seats; i++) {
      positions.push({
        bottom: "-8px",
        left: `${((i + 1) * 100) / (seatsPerSide + 1)}%`,
        transform: "translateX(-50%)",
      });
    }
    // Left chairs
    for (let i = 0; i < seatsPerSide && positions.length < seats; i++) {
      positions.push({
        left: "-8px",
        top: `${((i + 1) * 100) / (seatsPerSide + 1)}%`,
        transform: "translateY(-50%)",
      });
    }
    // Right chairs
    for (let i = 0; i < seatsPerSide && positions.length < seats; i++) {
      positions.push({
        right: "-8px",
        top: `${((i + 1) * 100) / (seatsPerSide + 1)}%`,
        transform: "translateY(-50%)",
      });
    }

    return positions.map((pos, i) => (
      <div key={i} className={chairClass} style={pos} />
    ));
  };

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center border-2 transition-all cursor-pointer select-none",
        shapeClasses[shape],
        statusColors[status],
        isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background border-primary shadow-lg shadow-primary/25",
        isEditing && "cursor-move",
        className
      )}
      style={style}
      onClick={onClick}
      draggable={isEditing}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {/* Chairs */}
      {renderChairs()}

      {/* Table content */}
      <span className={cn("font-bold text-sm", isSelected ? "text-primary" : statusTextColors[status])}>
        {tableNumber}
      </span>
      <span className={cn("text-[10px]", isSelected ? "text-primary/70" : "text-muted-foreground")}>
        {seats} seats
      </span>
    </div>
  );
}

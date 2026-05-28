import { useRef } from "react";
import { X } from "lucide-react";
import { TableElement } from "./TableElement";
import { cn } from "@/lib/utils";

export type TableShape = "square" | "round" | "rectangle";

export interface CanvasTable {
  id: string;
  table_number: string;
  shape: TableShape;
  seats: number;
  x_position: number;
  y_position: number;
  width: number;
  height: number;
  rotation: number;
  status: "available" | "occupied" | "reserved";
  zone: string;
}

type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const PX_PER_UNIT = 4;
const MIN_SIZE = 6;
const MAX_SIZE = 48;

const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  nw: "nwse-resize",
  n: "ns-resize",
  ne: "nesw-resize",
  e: "ew-resize",
  se: "nwse-resize",
  s: "ns-resize",
  sw: "nesw-resize",
  w: "ew-resize",
};

const HANDLE_POSITIONS: Record<ResizeHandle, string> = {
  nw: "-top-1.5 -left-1.5",
  n: "-top-1.5 left-1/2 -translate-x-1/2",
  ne: "-top-1.5 -right-1.5",
  e: "top-1/2 -right-1.5 -translate-y-1/2",
  se: "-bottom-1.5 -right-1.5",
  s: "-bottom-1.5 left-1/2 -translate-x-1/2",
  sw: "-bottom-1.5 -left-1.5",
  w: "top-1/2 -left-1.5 -translate-y-1/2",
};

function clampSize(n: number) {
  return Math.round(Math.max(MIN_SIZE, Math.min(MAX_SIZE, n)));
}

function tablePixelSize(table: CanvasTable) {
  const w = table.width * PX_PER_UNIT;
  const h = (table.shape === "rectangle" ? table.height : table.width) * PX_PER_UNIT;
  return { w, h };
}

interface Props {
  table: CanvasTable;
  isSelected: boolean;
  zoneBadgeClass?: string;
  onSelect: (table: CanvasTable) => void;
  onMove: (tableId: string, x: number, y: number) => void;
  onMoveComplete: (tableId: string, x: number, y: number) => void;
  onResize: (tableId: string, size: { width: number; height: number }) => void;
  onResizeComplete: (tableId: string, size: { width: number; height: number }) => void;
  onDelete: (tableId: string) => void;
}

export function TableCanvasItem({
  table,
  isSelected,
  zoneBadgeClass,
  onSelect,
  onMove,
  onMoveComplete,
  onResize,
  onResizeComplete,
  onDelete,
}: Props) {
  const moveRef = useRef({ active: false });

  const { w, h } = tablePixelSize(table);
  const isUniform = table.shape !== "rectangle";

  const startMove = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-resize-handle]")) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(table);

    const canvas = (e.currentTarget as HTMLElement).closest("[data-floor-canvas]");
    if (!canvas) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const THRESHOLD = 4;
    let dragged = false;
    let lastX = table.x_position;
    let lastY = table.y_position;

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragged) {
        if (Math.abs(ev.clientX - startX) < THRESHOLD && Math.abs(ev.clientY - startY) < THRESHOLD) return;
        dragged = true;
        moveRef.current.active = true;
      }
      const rect = canvas.getBoundingClientRect();
      lastX = Math.max(5, Math.min(95, ((ev.clientX - rect.left) / rect.width) * 100));
      lastY = Math.max(5, Math.min(95, ((ev.clientY - rect.top) / rect.height) * 100));
      onMove(table.id, lastX, lastY);
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      moveRef.current.active = false;
      if (dragged) onMoveComplete(table.id, lastX, lastY);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const startResize = (e: React.MouseEvent, handle: ResizeHandle) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(table);

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = table.width;
    const startH = table.shape === "rectangle" ? table.height : table.width;
    let lastW = startW;
    let lastH = startH;

    const onMouseMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / PX_PER_UNIT;
      const dy = (ev.clientY - startY) / PX_PER_UNIT;

      let nextW = startW;
      let nextH = startH;

      if (isUniform) {
        let delta = 0;
        if (handle.includes("e")) delta = Math.max(delta, dx);
        if (handle.includes("w")) delta = Math.max(delta, -dx);
        if (handle.includes("s")) delta = Math.max(delta, dy);
        if (handle.includes("n")) delta = Math.max(delta, -dy);
        nextW = clampSize(startW + delta);
        nextH = nextW;
      } else {
        if (handle.includes("e")) nextW = clampSize(startW + dx);
        if (handle.includes("w")) nextW = clampSize(startW - dx);
        if (handle.includes("s")) nextH = clampSize(startH + dy);
        if (handle.includes("n")) nextH = clampSize(startH - dy);
      }

      lastW = nextW;
      lastH = nextH;
      onResize(table.id, { width: nextW, height: nextH });
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      onResizeComplete(table.id, { width: lastW, height: lastH });
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  return (
    <div
      className="absolute group"
      style={{
        left: `${table.x_position}%`,
        top: `${table.y_position}%`,
        transform: `translate(-50%, -50%) rotate(${table.rotation}deg)`,
        width: w,
        height: h,
      }}
      onMouseDown={startMove}
    >
      {isSelected && (
        <div
          className="absolute -inset-1 rounded-lg border-2 border-primary pointer-events-none z-10"
          aria-hidden
        />
      )}

      {isSelected &&
        (Object.keys(HANDLE_POSITIONS) as ResizeHandle[]).map((handle) => (
          <button
            key={handle}
            type="button"
            data-resize-handle={handle}
            className={cn(
              "absolute z-20 h-3 w-3 rounded-full border-2 border-background bg-primary shadow-sm pointer-events-auto hover:scale-110 transition-transform",
              HANDLE_POSITIONS[handle]
            )}
            style={{ cursor: HANDLE_CURSORS[handle] }}
            onMouseDown={(e) => startResize(e, handle)}
            aria-label={`Resize ${handle}`}
          />
        ))}

      <button
        type="button"
        className="absolute -top-2 -right-2 z-30 rounded-full bg-destructive p-1 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:scale-110"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(table.id);
        }}
        title="Delete table"
      >
        <X className="h-3 w-3" />
      </button>

      <TableElement
        id={table.id}
        tableNumber={table.table_number}
        shape={table.shape}
        seats={table.seats}
        status={table.status}
        isSelected={isSelected}
        isEditing
        className="h-full w-full"
        style={{ width: "100%", height: "100%" }}
      />

      <span
        className={cn(
          "absolute -bottom-5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded border px-1.5 py-0 text-[9px]",
          zoneBadgeClass || "bg-muted"
        )}
      >
        {table.zone}
      </span>
    </div>
  );
}

export { PX_PER_UNIT, MIN_SIZE, MAX_SIZE };

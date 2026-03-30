import { cn } from "@/lib/utils";

interface TableSelectorProps {
  selectedTable: string;
  onSelectTable: (table: string) => void;
  className?: string;
}

const tables = [
  { id: "1", shape: "square" },
  { id: "2", shape: "square" },
  { id: "3", shape: "round" },
  { id: "4", shape: "square" },
  { id: "5", shape: "round" },
  { id: "6", shape: "square" },
  { id: "7", shape: "square" },
  { id: "8", shape: "round" },
  { id: "9", shape: "square" },
  { id: "10", shape: "square" },
  { id: "11", shape: "round" },
  { id: "12", shape: "square" },
];

export function TableSelector({ selectedTable, onSelectTable, className }: TableSelectorProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">Select a Table</p>
        {selectedTable && (
          <span className="text-xs text-primary font-medium">Table {selectedTable}</span>
        )}
      </div>
      
      <div className="grid grid-cols-4 gap-2">
        {tables.map((table) => {
          const isSelected = selectedTable === table.id;
          return (
            <button
              key={table.id}
              type="button"
              onClick={() => onSelectTable(table.id)}
              className={cn(
                "relative aspect-square flex items-center justify-center transition-all duration-200",
                "border-2 hover:scale-105 active:scale-95",
                table.shape === "round" ? "rounded-full" : "rounded-lg",
                isSelected
                  ? "border-primary bg-primary/20 text-primary shadow-lg shadow-primary/25"
                  : "border-border/50 bg-muted/30 text-muted-foreground hover:border-primary/50 hover:bg-primary/5"
              )}
            >
              {/* Table icon representation */}
              <div className={cn(
                "absolute inset-2 border border-dashed opacity-30",
                table.shape === "round" ? "rounded-full" : "rounded-md"
              )} />
              
              {/* Chairs representation */}
              {table.shape === "square" && (
                <>
                  <div className={cn(
                    "absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-1 rounded-full",
                    isSelected ? "bg-primary/60" : "bg-muted-foreground/30"
                  )} />
                  <div className={cn(
                    "absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-1 rounded-full",
                    isSelected ? "bg-primary/60" : "bg-muted-foreground/30"
                  )} />
                  <div className={cn(
                    "absolute -left-1 top-1/2 -translate-y-1/2 h-3 w-1 rounded-full",
                    isSelected ? "bg-primary/60" : "bg-muted-foreground/30"
                  )} />
                  <div className={cn(
                    "absolute -right-1 top-1/2 -translate-y-1/2 h-3 w-1 rounded-full",
                    isSelected ? "bg-primary/60" : "bg-muted-foreground/30"
                  )} />
                </>
              )}
              
              {table.shape === "round" && (
                <>
                  <div className={cn(
                    "absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-1 rounded-full",
                    isSelected ? "bg-primary/60" : "bg-muted-foreground/30"
                  )} />
                  <div className={cn(
                    "absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-1 rounded-full",
                    isSelected ? "bg-primary/60" : "bg-muted-foreground/30"
                  )} />
                  <div className={cn(
                    "absolute top-1/4 -left-1 w-1 h-2 rounded-full",
                    isSelected ? "bg-primary/60" : "bg-muted-foreground/30"
                  )} />
                  <div className={cn(
                    "absolute top-1/4 -right-1 w-1 h-2 rounded-full",
                    isSelected ? "bg-primary/60" : "bg-muted-foreground/30"
                  )} />
                  <div className={cn(
                    "absolute bottom-1/4 -left-1 w-1 h-2 rounded-full",
                    isSelected ? "bg-primary/60" : "bg-muted-foreground/30"
                  )} />
                  <div className={cn(
                    "absolute bottom-1/4 -right-1 w-1 h-2 rounded-full",
                    isSelected ? "bg-primary/60" : "bg-muted-foreground/30"
                  )} />
                </>
              )}
              
              <span className={cn(
                "font-bold text-sm z-10",
                isSelected ? "text-primary" : "text-foreground/70"
              )}>
                {table.id}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

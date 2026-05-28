import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChefHat,
  ClipboardList,
  LayoutDashboard,
  Map,
  UtensilsCrossed,
  Loader2,
} from "lucide-react";
import type { TourModule, TourModuleId } from "@/lib/product-tour/types";

const MODULE_ICONS: Record<TourModuleId, typeof LayoutDashboard> = {
  overview: Map,
  dashboard: LayoutDashboard,
  orders: ClipboardList,
  menu: UtensilsCrossed,
  kitchen: ChefHat,
};

interface TourLauncherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modules: TourModule[];
  onSelect: (id: TourModuleId) => void;
  isRunning: boolean;
}

export function TourLauncherDialog({
  open,
  onOpenChange,
  modules,
  onSelect,
  isRunning,
}: TourLauncherDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>App tour</DialogTitle>
          <DialogDescription>
            Interactive walkthroughs by module. Follow along on the live screens — great for new
            staff or a refresher before service.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-1">
          {modules.map((mod) => {
            const Icon = MODULE_ICONS[mod.id];
            return (
              <Button
                key={mod.id}
                variant="outline"
                className="h-auto justify-start gap-3 px-4 py-3 text-left"
                disabled={isRunning}
                onClick={() => onSelect(mod.id)}
              >
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                  {isRunning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{mod.title}</span>
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      ~{mod.estimatedMinutes} min
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {mod.description}
                  </p>
                </div>
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

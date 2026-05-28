import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart2,
  Boxes,
  ChefHat,
  ClipboardList,
  History,
  IndianRupee,
  LayoutGrid,
  Loader2,
  Package,
  Pencil,
  Settings,
  ShoppingCart,
  Sparkles,
  Store,
  UserCog,
  Users,
  UtensilsCrossed,
  Link2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDashboardQuickActions } from "@/hooks/use-dashboard-quick-actions";
import { useProductTour } from "@/lib/product-tour/tour-context";
import {
  MAX_QUICK_ACTIONS,
  type QuickActionDefinition,
  type QuickActionId,
} from "@/lib/dashboard-quick-actions";

const ICONS: Record<string, LucideIcon> = {
  "new-order": ShoppingCart,
  orders: LayoutGrid,
  kitchen: ChefHat,
  menu: UtensilsCrossed,
  payments: IndianRupee,
  "order-history": History,
  customers: Users,
  analytics: BarChart2,
  outlets: Store,
  staff: UserCog,
  settings: Settings,
  integrations: Link2,
  inventory: Boxes,
  addons: Package,
  "app-tour": Sparkles,
};

const COLOR_MAP: Record<string, string> = {
  "new-order": "bg-primary/15 text-primary ring-primary/25 group-hover:bg-primary/25",
  orders: "bg-primary/15 text-primary ring-primary/25 group-hover:bg-primary/25",
  kitchen: "bg-accent/15 text-accent ring-accent/25 group-hover:bg-accent/25",
  menu: "bg-success/15 text-success ring-success/25 group-hover:bg-success/25",
  payments: "bg-emerald-500/15 text-emerald-700 ring-emerald-500/25 group-hover:bg-emerald-500/25",
  "order-history": "bg-slate-500/15 text-slate-700 ring-slate-500/25 group-hover:bg-slate-500/25",
  customers: "bg-blue-500/15 text-blue-700 ring-blue-500/25 group-hover:bg-blue-500/25",
  analytics: "bg-violet-500/15 text-violet-700 ring-violet-500/25 group-hover:bg-violet-500/25",
  outlets: "bg-purple-500/15 text-purple-600 ring-purple-500/25 group-hover:bg-purple-500/25",
  staff: "bg-indigo-500/15 text-indigo-700 ring-indigo-500/25 group-hover:bg-indigo-500/25",
  settings: "bg-muted text-foreground ring-border group-hover:bg-muted/80",
  integrations: "bg-orange-500/15 text-orange-700 ring-orange-500/25 group-hover:bg-orange-500/25",
  inventory: "bg-teal-500/15 text-teal-700 ring-teal-500/25 group-hover:bg-teal-500/25",
  addons: "bg-fuchsia-500/15 text-fuchsia-700 ring-fuchsia-500/25 group-hover:bg-fuchsia-500/25",
  "app-tour": "bg-primary/15 text-primary ring-primary/25 group-hover:bg-primary/25",
};

function QuickActionIcon({ action, onTour }: { action: QuickActionDefinition; onTour?: () => void }) {
  const Icon = ICONS[action.id] ?? ClipboardList;
  const color = COLOR_MAP[action.id] ?? "bg-muted text-foreground ring-border";

  if (action.isTour) {
    return (
      <button
        type="button"
        title={action.description}
        onClick={onTour}
        className="group flex flex-col items-center gap-2.5 min-w-[72px] max-w-[88px] sm:min-w-[80px] sm:max-w-[96px]"
      >
        <div
          className={cn(
            "flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full ring-1 transition-all",
            "group-hover:scale-105 group-hover:shadow-md",
            color
          )}
        >
          <Icon className="h-6 w-6 sm:h-7 sm:w-7 shrink-0" />
        </div>
        <span className="text-xs sm:text-sm font-medium text-center text-foreground leading-tight group-hover:text-primary transition-colors">
          {action.title}
        </span>
      </button>
    );
  }

  return (
    <Link
      to={action.href}
      title={action.description}
      className="group flex flex-col items-center gap-2.5 min-w-[72px] max-w-[88px] sm:min-w-[80px] sm:max-w-[96px]"
    >
      <div
        className={cn(
          "flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full ring-1 transition-all",
          "group-hover:scale-105 group-hover:shadow-md",
          color
        )}
      >
        <Icon className="h-6 w-6 sm:h-7 sm:w-7 shrink-0" />
      </div>
      <span className="text-xs sm:text-sm font-medium text-center text-foreground leading-tight group-hover:text-primary transition-colors">
        {action.title}
      </span>
    </Link>
  );
}

export function DashboardQuickActions() {
  const { openLauncher } = useProductTour();
  const { loading, saving, activeActions, activeIds, accessibleCatalog, saveActions, isOwner } =
    useDashboardQuickActions();
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [draftIds, setDraftIds] = useState<QuickActionId[]>([]);

  useEffect(() => {
    if (customizeOpen) setDraftIds([...activeIds]);
  }, [customizeOpen, activeIds]);

  const toggleDraft = (id: QuickActionId) => {
    setDraftIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_QUICK_ACTIONS) {
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleSave = async () => {
    const ok = await saveActions(draftIds);
    if (ok) setCustomizeOpen(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (activeActions.length === 0) return null;

  return (
    <div className="space-y-4" data-tour="dashboard-actions">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Quick Actions
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs text-muted-foreground"
          onClick={() => setCustomizeOpen(true)}
        >
          <Pencil className="h-3.5 w-3.5" />
          Customize
        </Button>
      </div>

      <div className="flex flex-wrap gap-6 sm:gap-8">
        {activeActions.map((action) => (
          <QuickActionIcon
            key={action.id}
            action={action}
            onTour={action.isTour ? openLauncher : undefined}
          />
        ))}
      </div>

      <Dialog open={customizeOpen} onOpenChange={setCustomizeOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Customize quick actions</DialogTitle>
            <DialogDescription>
              Pick up to {MAX_QUICK_ACTIONS} shortcuts for your dashboard.
              {isOwner
                ? " Saved to your account on all devices."
                : " Saved on this device only."}
            </DialogDescription>
          </DialogHeader>

          <p className="text-xs text-muted-foreground">
            Selected {draftIds.length} / {MAX_QUICK_ACTIONS}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {accessibleCatalog.map((action) => {
              const selected = draftIds.includes(action.id);
              const disabled = !selected && draftIds.length >= MAX_QUICK_ACTIONS;
              return (
                <button
                  key={action.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleDraft(action.id)}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                    selected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/40 hover:bg-muted/50",
                    disabled && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <p className="font-medium leading-tight">{action.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                    {action.description}
                  </p>
                </button>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomizeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving || draftIds.length === 0}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save shortcuts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

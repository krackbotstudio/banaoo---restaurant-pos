import { formatDistanceToNow } from "date-fns";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { InventoryMovement } from "@/lib/inventory";

export function InventoryMovementFeed({ movements }: { movements: InventoryMovement[] }) {
  if (movements.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent movements</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Stock adjustments will appear here once you record them.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent movements</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {movements.map((m) => (
          <div key={m.id} className="flex items-start gap-3 text-sm border-b border-border/60 pb-3 last:border-0 last:pb-0">
            {m.delta >= 0 ? (
              <ArrowUpRight className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{m.item_name}</p>
              <p className="text-muted-foreground">
                {m.delta >= 0 ? "+" : ""}
                {m.delta}
                {m.reason ? ` · ${m.reason}` : ""}
              </p>
              {m.notes ? <p className="text-xs text-muted-foreground mt-0.5">{m.notes}</p> : null}
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

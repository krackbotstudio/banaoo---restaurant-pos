import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon, Plus } from "lucide-react";

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  function EmptyState({ icon: Icon, title, description, actionLabel, onAction, className, ...props }, ref) {
    return (
      <Card ref={ref} className={cn("border-dashed border-2 bg-card/50", className)} {...props}>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-2xl bg-gradient-to-br from-muted to-muted/50 p-5 mb-5">
            <Icon className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="font-display text-xl font-semibold mb-2">{title}</h3>
          <p className="text-muted-foreground max-w-sm mb-6">{description}</p>
          {actionLabel && onAction && (
            <Button onClick={onAction} className="gradient-primary glow-primary">
              <Plus className="h-4 w-4 mr-2" />
              {actionLabel}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }
);

export { EmptyState };

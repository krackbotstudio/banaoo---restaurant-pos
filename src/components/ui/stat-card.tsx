import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  variant?: "default" | "primary" | "accent" | "success" | "purple";
  className?: string;
}

const variantStyles = {
  default: {
    icon: "bg-muted text-muted-foreground",
    card: "",
  },
  primary: {
    icon: "bg-primary/15 text-primary",
    card: "hover:border-primary/30",
  },
  accent: {
    icon: "bg-accent/15 text-accent",
    card: "hover:border-accent/30",
  },
  success: {
    icon: "bg-success/15 text-success",
    card: "hover:border-success/30",
  },
  purple: {
    icon: "bg-purple-500/15 text-purple-500",
    card: "hover:border-purple-500/30",
  },
};

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendUp,
  variant = "default",
  className,
}: StatCardProps) {
  const styles = variantStyles[variant];

  return (
    <Card className={cn(
      "transition-all duration-200 hover:shadow-elevated hover:-translate-y-0.5",
      styles.card,
      className
    )}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-semibold">{value}</p>
            {trend && (
              <p className={cn(
                "text-xs font-medium",
                trendUp ? "text-success" : "text-destructive"
              )}>
                {trend}
              </p>
            )}
          </div>
          <div className={cn("p-2.5 rounded-lg", styles.icon)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

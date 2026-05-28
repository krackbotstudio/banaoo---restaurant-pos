import { LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface CmsPlaceholderProps {
  title: string;
  description: string;
  icon: LucideIcon;
  phase?: string;
}

export default function CmsPlaceholder({ title, description, icon: Icon, phase }: CmsPlaceholderProps) {
  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>{title}</CardTitle>
              {phase ? (
                <CardDescription>
                  {phase} — coming in a future release
                </CardDescription>
              ) : (
                <CardDescription>{description}</CardDescription>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </div>
  );
}

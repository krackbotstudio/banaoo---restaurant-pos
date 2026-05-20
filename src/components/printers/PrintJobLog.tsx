import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import type { PrintJobRecord } from "@/lib/print/types";
import { format } from "date-fns";

interface Props {
  jobs: PrintJobRecord[];
  isLoading: boolean;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  done: "default",
  pending: "secondary",
  printing: "outline",
  failed: "destructive",
};

export function PrintJobLogPanel({ jobs, isLoading }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Print log</CardTitle>
        <CardDescription>Recent print jobs — failed jobs can be retried from the order screen.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No print jobs recorded yet.</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {jobs.map((job) => {
              const payload = job.payload as { orderNumber?: string };
              return (
                <div
                  key={job.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 rounded-lg border p-2.5 text-sm"
                >
                  <div>
                    <span className="font-medium uppercase text-xs">{job.job_type}</span>
                    {payload.orderNumber ? (
                      <span className="text-muted-foreground ml-2">#{payload.orderNumber}</span>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(job.created_at), "dd MMM yyyy, h:mm a")}
                    </p>
                    {job.last_error ? (
                      <p className="text-xs text-destructive mt-0.5">{job.last_error}</p>
                    ) : null}
                  </div>
                  <Badge variant={STATUS_VARIANT[job.status] ?? "secondary"}>{job.status}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

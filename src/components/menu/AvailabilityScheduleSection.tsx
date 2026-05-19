import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AvailabilityWindow,
  DAY_LABELS,
  DEFAULT_SCHEDULE_WINDOW,
  formatScheduleSummary,
  emptySchedule,
  type AvailabilitySchedule,
} from "@/lib/menu-availability";
import { Clock, Plus, Trash2 } from "lucide-react";

interface AvailabilityScheduleSectionProps {
  scheduleEnabled: boolean;
  onScheduleEnabledChange: (enabled: boolean) => void;
  schedule: AvailabilitySchedule;
  onScheduleChange: (schedule: AvailabilitySchedule) => void;
}

function toggleDay(window: AvailabilityWindow, day: number): AvailabilityWindow {
  const days = window.days.includes(day)
    ? window.days.filter((d) => d !== day)
    : [...window.days, day].sort((a, b) => a - b);
  return { ...window, days: days.length ? days : [day] };
}

export function AvailabilityScheduleSection({
  scheduleEnabled,
  onScheduleEnabledChange,
  schedule,
  onScheduleChange,
}: AvailabilityScheduleSectionProps) {
  const windows = schedule.windows.length
    ? schedule.windows
    : [{ ...DEFAULT_SCHEDULE_WINDOW }];

  const updateWindow = (index: number, patch: Partial<AvailabilityWindow>) => {
    const next = windows.map((w, i) => (i === index ? { ...w, ...patch } : w));
    onScheduleChange({ ...schedule, windows: next });
  };

  const addWindow = () => {
    onScheduleChange({
      ...schedule,
      windows: [...windows, { days: [1, 2, 3, 4, 5], start: "09:00", end: "14:00" }],
    });
  };

  const removeWindow = (index: number) => {
    if (windows.length <= 1) return;
    onScheduleChange({
      ...schedule,
      windows: windows.filter((_, i) => i !== index),
    });
  };

  const handleEnable = (on: boolean) => {
    onScheduleEnabledChange(on);
    if (on && !schedule.windows.length) {
      onScheduleChange(emptySchedule());
    }
  };

  return (
    <div className="space-y-3 pt-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" />
        Automatic schedule
      </p>

      <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20 p-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text-sm font-medium">Limit by days &amp; time</span>
            <p className="text-xs text-muted-foreground mt-0.5">
              Item hides outside these hours. Turn off &quot;Available&quot; to disable completely.
            </p>
          </div>
          <Switch checked={scheduleEnabled} onCheckedChange={handleEnable} />
        </div>

        {scheduleEnabled && (
          <>
            {windows.map((win, idx) => (
              <div
                key={`win-${idx}`}
                className="rounded-md border bg-background/80 p-3 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Time slot {windows.length > 1 ? idx + 1 : ""}
                  </span>
                  {windows.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeWindow(idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Days</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {DAY_LABELS.map((label, day) => (
                      <Button
                        key={label}
                        type="button"
                        variant={win.days.includes(day) ? "default" : "outline"}
                        size="sm"
                        className="h-8 px-2.5 text-xs rounded-full"
                        onClick={() => updateWindow(idx, toggleDay(win, day))}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">From</Label>
                    <Input
                      type="time"
                      value={win.start}
                      onChange={(e) => updateWindow(idx, { start: e.target.value })}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">To</Label>
                    <Input
                      type="time"
                      value={win.end}
                      onChange={(e) => updateWindow(idx, { end: e.target.value })}
                      className="h-9"
                    />
                  </div>
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addWindow}>
              <Plus className="h-3.5 w-3.5" />
              Add another time slot
            </Button>

            {formatScheduleSummary(schedule) && (
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Active: {formatScheduleSummary(schedule)} (IST)
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

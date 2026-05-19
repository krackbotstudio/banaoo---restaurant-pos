/** Day/time windows for menu item availability. days: 0=Sun … 6=Sat (JS Date.getDay). */

export const DEFAULT_MENU_TIMEZONE = "Asia/Kolkata";

export interface AvailabilityWindow {
  days: number[];
  start: string;
  end: string;
}

export interface AvailabilitySchedule {
  timezone?: string;
  windows: AvailabilityWindow[];
}

export interface MenuAvailabilityFields {
  is_available: boolean;
  schedule_enabled?: boolean;
  availability_schedule?: AvailabilitySchedule | null;
}

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const DEFAULT_SCHEDULE_WINDOW: AvailabilityWindow = {
  days: [0, 1, 2, 3, 4, 5, 6],
  start: "09:00",
  end: "22:00",
};

export function emptySchedule(): AvailabilitySchedule {
  return { timezone: DEFAULT_MENU_TIMEZONE, windows: [{ ...DEFAULT_SCHEDULE_WINDOW }] };
}

export function parseAvailabilitySchedule(raw: unknown): AvailabilitySchedule | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const windowsRaw = obj.windows;
  if (!Array.isArray(windowsRaw) || windowsRaw.length === 0) return null;

  const windows: AvailabilityWindow[] = [];
  for (const w of windowsRaw) {
    if (!w || typeof w !== "object") continue;
    const wr = w as Record<string, unknown>;
    const days = Array.isArray(wr.days)
      ? wr.days.map((d) => Number(d)).filter((d) => d >= 0 && d <= 6)
      : [];
    const start = typeof wr.start === "string" ? wr.start : "09:00";
    const end = typeof wr.end === "string" ? wr.end : "22:00";
    if (days.length === 0) continue;
    windows.push({ days, start, end });
  }

  if (windows.length === 0) return null;
  return {
    timezone:
      typeof obj.timezone === "string" && obj.timezone.trim()
        ? obj.timezone.trim()
        : DEFAULT_MENU_TIMEZONE,
    windows,
  };
}

function parseHm(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function formatHm12(hm: string): string {
  const mins = parseHm(hm);
  if (mins == null) return hm;
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function getZonedParts(now: Date, timeZone: string): { dow: number; minutes: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const dowMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return { dow: dowMap[weekday] ?? 0, minutes: hour * 60 + minute };
}

function isWithinWindow(
  dow: number,
  minutes: number,
  window: AvailabilityWindow
): boolean {
  if (!window.days.includes(dow)) return false;
  const start = parseHm(window.start);
  const end = parseHm(window.end);
  if (start == null || end == null) return false;
  if (start <= end) {
    return minutes >= start && minutes < end;
  }
  return minutes >= start || minutes < end;
}

export function isItemEffectivelyAvailable(
  item: MenuAvailabilityFields,
  now: Date = new Date()
): boolean {
  if (!item.is_available) return false;
  if (!item.schedule_enabled) return true;

  const schedule = parseAvailabilitySchedule(item.availability_schedule);
  if (!schedule?.windows.length) return true;

  const tz = schedule.timezone ?? DEFAULT_MENU_TIMEZONE;
  const { dow, minutes } = getZonedParts(now, tz);
  return schedule.windows.some((w) => isWithinWindow(dow, minutes, w));
}

export function formatDaysShort(days: number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 7) return "Every day";
  if (
    sorted.length === 5 &&
    [1, 2, 3, 4, 5].every((d) => sorted.includes(d))
  ) {
    return "Mon–Fri";
  }
  if (
    sorted.length === 2 &&
    sorted.includes(0) &&
    sorted.includes(6)
  ) {
    return "Sat–Sun";
  }
  return sorted.map((d) => DAY_LABELS[d]).join(", ");
}

export function formatScheduleSummary(schedule: AvailabilitySchedule | null): string {
  if (!schedule?.windows.length) return "";
  return schedule.windows
    .map((w) => `${formatDaysShort(w.days)}, ${formatHm12(w.start)} – ${formatHm12(w.end)}`)
    .join(" · ");
}

export function getItemAvailabilityLabel(
  item: MenuAvailabilityFields,
  now: Date = new Date()
): { label: string; variant: "available" | "unavailable" | "scheduled-off" } {
  if (!item.is_available) {
    return { label: "Unavailable", variant: "unavailable" };
  }
  if (!item.schedule_enabled) {
    return { label: "Available", variant: "available" };
  }
  const schedule = parseAvailabilitySchedule(item.availability_schedule);
  if (!schedule?.windows.length) {
    return { label: "Available", variant: "available" };
  }
  if (isItemEffectivelyAvailable(item, now)) {
    return { label: "Available now", variant: "available" };
  }
  const summary = formatScheduleSummary(schedule);
  return {
    label: summary ? `Off · ${summary}` : "Off schedule",
    variant: "scheduled-off",
  };
}

export function buildSchedulePayload(
  scheduleEnabled: boolean,
  schedule: AvailabilitySchedule | null
): Pick<MenuAvailabilityFields, "schedule_enabled" | "availability_schedule"> {
  if (!scheduleEnabled) {
    return { schedule_enabled: false, availability_schedule: null };
  }
  const parsed = schedule ? parseAvailabilitySchedule(schedule) : null;
  return {
    schedule_enabled: true,
    availability_schedule: parsed ?? emptySchedule(),
  };
}

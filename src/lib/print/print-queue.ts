import type { PrintJobRecord } from "./types";

const QUEUE_KEY = "banaoo_print_queue_v1";
const MAX_LOCAL = 200;

export interface LocalQueuedJob {
  id: string;
  outletId: string;
  printerId: string;
  jobType: string;
  payload: Record<string, unknown>;
  attempts: number;
  createdAt: string;
  lastError?: string;
}

function readLocal(): LocalQueuedJob[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalQueuedJob[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(jobs: LocalQueuedJob[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(jobs.slice(0, MAX_LOCAL)));
  } catch {
    /* quota */
  }
}

export function enqueueLocal(job: Omit<LocalQueuedJob, "attempts" | "createdAt">): LocalQueuedJob {
  const entry: LocalQueuedJob = {
    ...job,
    attempts: 0,
    createdAt: new Date().toISOString(),
  };
  const all = readLocal();
  all.unshift(entry);
  writeLocal(all);
  return entry;
}

export function updateLocalJob(id: string, patch: Partial<LocalQueuedJob>): void {
  const all = readLocal().map((j) => (j.id === id ? { ...j, ...patch } : j));
  writeLocal(all);
}

export function removeLocalJob(id: string): void {
  writeLocal(readLocal().filter((j) => j.id !== id));
}

export function listLocalPending(outletId: string): LocalQueuedJob[] {
  return readLocal().filter((j) => j.outletId === outletId);
}

export function printJobToPayload(job: PrintJobRecord): Record<string, unknown> {
  return typeof job.payload === "object" && job.payload !== null
    ? (job.payload as Record<string, unknown>)
    : {};
}

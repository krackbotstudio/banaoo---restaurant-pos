export type TourModuleId =
  | "overview"
  | "dashboard"
  | "orders"
  | "menu"
  | "kitchen";

export interface TourStep {
  element: string;
  title: string;
  description: string;
  side?: "top" | "bottom" | "left" | "right";
}

export interface TourModule {
  id: TourModuleId;
  title: string;
  description: string;
  route?: string;
  /** Permission key required (owner always allowed). Omit for universal steps. */
  permission?: string;
  steps: TourStep[];
  estimatedMinutes: number;
}

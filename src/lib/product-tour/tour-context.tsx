import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { driver, type DriveStep, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useAuth } from "@/lib/auth";
import { useStaffPermissions } from "@/lib/use-staff-permissions";
import { getAvailableModules, TOUR_MODULES } from "./definitions";
import {
  completeProductTourModule,
  dismissProductTour,
  TOUR_STORAGE_KEY,
} from "./api";
import type { TourModuleId } from "./types";
import { TourLauncherDialog } from "@/components/tour/TourLauncherDialog";
import { TourWelcomeDialog } from "@/components/tour/TourWelcomeDialog";

interface ProductTourContextValue {
  openLauncher: () => void;
  startTour: (moduleId: TourModuleId) => Promise<void>;
  dismissWelcome: () => Promise<void>;
  checkWelcomeOnDashboard: () => void;
  isRunning: boolean;
}

const ProductTourContext = createContext<ProductTourContextValue | undefined>(undefined);

async function waitForSelector(selector: string, maxMs = 10000): Promise<Element | null> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const el = document.querySelector(selector);
    if (el) return el;
    await new Promise((r) => setTimeout(r, 120));
  }
  return null;
}

export function ProductTourProvider({ children }: { children: ReactNode }) {
  const { profile, refreshProfile } = useAuth();
  const { permissions } = useStaffPermissions();
  const navigate = useNavigate();
  const location = useLocation();

  const [launcherOpen, setLauncherOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const driverRef = useRef<Driver | null>(null);
  const welcomeCheckedRef = useRef(false);

  const isOwner = !profile || profile.role === "owner";
  const availableModules = useMemo(
    () => getAvailableModules(isOwner, permissions),
    [isOwner, permissions]
  );

  const shouldShowWelcome = useMemo(() => {
    if (localStorage.getItem(TOUR_STORAGE_KEY) === "1") return false;
    if (profile?.product_tour_dismissed_at || profile?.product_tour_completed_at) return false;
    if (!profile?.onboarding_completed) return false;
    return true;
  }, [profile]);

  const destroyDriver = useCallback(() => {
    driverRef.current?.destroy();
    driverRef.current = null;
    setIsRunning(false);
  }, []);

  const startTour = useCallback(
    async (moduleId: TourModuleId) => {
      const mod = TOUR_MODULES[moduleId];
      if (!mod) return;

      if (
        mod.permission &&
        !isOwner &&
        permissions !== null &&
        (!Array.isArray(permissions) || !permissions.includes(mod.permission))
      ) {
        return;
      }

      destroyDriver();
      setLauncherOpen(false);
      setWelcomeOpen(false);
      setIsRunning(true);

      if (mod.route && location.pathname !== mod.route) {
        navigate(mod.route);
      }

      const resolvedSteps: DriveStep[] = [];
      for (const step of mod.steps) {
        const el = await waitForSelector(step.element);
        if (el) {
          resolvedSteps.push({
            element: step.element,
            popover: {
              title: step.title,
              description: step.description,
              side: step.side,
            },
          });
        }
      }

      if (resolvedSteps.length === 0) {
        setIsRunning(false);
        return;
      }

      const driverObj = driver({
        showProgress: true,
        animate: true,
        smoothScroll: true,
        allowClose: true,
        overlayOpacity: 0.55,
        stagePadding: 8,
        steps: resolvedSteps,
        nextBtnText: "Next",
        prevBtnText: "Back",
        doneBtnText: "Done",
        onDestroyed: () => {
          driverRef.current = null;
          setIsRunning(false);
          void completeProductTourModule(moduleId);
          void refreshProfile();
        },
      });

      driverRef.current = driverObj;
      driverObj.drive();
    },
    [destroyDriver, isOwner, location.pathname, navigate, permissions, refreshProfile]
  );

  const dismissWelcome = useCallback(async () => {
    await dismissProductTour();
    await refreshProfile();
    setWelcomeOpen(false);
  }, [refreshProfile]);

  const checkWelcomeOnDashboard = useCallback(() => {
    if (welcomeCheckedRef.current) return;
    if (!shouldShowWelcome) return;
    if (location.pathname !== "/dashboard") return;
    welcomeCheckedRef.current = true;
    setWelcomeOpen(true);
  }, [location.pathname, shouldShowWelcome]);

  const value = useMemo(
    () => ({
      openLauncher: () => setLauncherOpen(true),
      startTour,
      dismissWelcome,
      checkWelcomeOnDashboard,
      isRunning,
    }),
    [checkWelcomeOnDashboard, dismissWelcome, isRunning, startTour]
  );

  return (
    <ProductTourContext.Provider value={value}>
      {children}
      <TourWelcomeDialog
        open={welcomeOpen}
        onOpenChange={setWelcomeOpen}
        onStartOverview={() => void startTour("overview")}
        onPickModule={() => {
          setWelcomeOpen(false);
          setLauncherOpen(true);
        }}
        onDismiss={() => void dismissWelcome()}
      />
      <TourLauncherDialog
        open={launcherOpen}
        onOpenChange={setLauncherOpen}
        modules={availableModules}
        onSelect={(id) => void startTour(id)}
        isRunning={isRunning}
      />
    </ProductTourContext.Provider>
  );
}

export function useProductTour() {
  const ctx = useContext(ProductTourContext);
  if (!ctx) throw new Error("useProductTour must be used within ProductTourProvider");
  return ctx;
}

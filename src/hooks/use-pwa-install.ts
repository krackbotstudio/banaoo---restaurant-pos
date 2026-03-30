import { useEffect, useState } from "react";

const INSTALLED_KEY = "banaoo_pwa_installed";

function isRunningStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export function usePwaInstall() {
  // Read prompt from global capture done in main.tsx before React mounted
  const [hasNativePrompt, setHasNativePrompt] = useState(
    () => !!window.__pwaInstallPrompt
  );
  const [isInstalled, setIsInstalled] = useState(() => {
    const standalone = isRunningStandalone();
    // Only trust localStorage if the app is actually running standalone.
    // This prevents a stale key from permanently hiding the banner.
    if (!standalone && localStorage.getItem(INSTALLED_KEY) === "true") {
      localStorage.removeItem(INSTALLED_KEY);
      return false;
    }
    return standalone;
  });
  // Initialize eagerly so shouldShow is correct on first render (not delayed by useEffect)
  const [isIOS] = useState(
    () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream
  );
  const [isMobile] = useState(
    () => /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)
  );

  useEffect(() => {

    if (isRunningStandalone()) {
      setIsInstalled(true);
      localStorage.setItem(INSTALLED_KEY, "true");
      return;
    }

    // If beforeinstallprompt fires later (e.g. after SW registers), capture it
    const onPrompt = (e: Event) => {
      e.preventDefault();
      window.__pwaInstallPrompt = e as typeof window.__pwaInstallPrompt;
      setHasNativePrompt(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // appinstalled = user accepted from native browser UI (outside our button)
    const onInstalled = () => {
      setIsInstalled(true);
      localStorage.setItem(INSTALLED_KEY, "true");
      window.__pwaInstallPrompt = null;
      setHasNativePrompt(false);
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Trigger native browser install prompt (Android / Chrome)
  const install = async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    const prompt = window.__pwaInstallPrompt;
    if (!prompt) return "unavailable";
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
      localStorage.setItem(INSTALLED_KEY, "true");
      window.__pwaInstallPrompt = null;
      setHasNativePrompt(false);
    }
    return outcome;
  };

  // Show the install UI whenever: mobile + not installed
  const shouldShow = isMobile && !isInstalled;

  return {
    shouldShow,
    isIOS,
    hasNativePrompt, // true = can trigger programmatic install
    install,
  };
}

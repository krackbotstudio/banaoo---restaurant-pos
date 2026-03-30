import { useState } from "react";
import { Download, X, Smartphone, MoreVertical, Share } from "lucide-react";
import { usePwaInstall } from "@/hooks/use-pwa-install";

interface InstallAppBannerProps {
  restaurantName: string;
}

// ── Instruction modal shown when native prompt isn't available ─────────────────
function HowToInstallModal({
  isIOS,
  onClose,
}: {
  isIOS: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm px-4 pb-6">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-gray-900">
              Add to Home Screen
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 active:text-gray-600 p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Steps */}
        <div className="px-5 py-5 space-y-4">
          {isIOS ? (
            <>
              <Step n={1} icon={<Share className="h-4 w-4 text-primary" />}>
                Tap the <strong>Share</strong> button at the bottom of your Safari browser
              </Step>
              <Step n={2} icon={<span className="text-primary text-sm font-bold">+</span>}>
                Scroll down and tap{" "}
                <strong>&ldquo;Add to Home Screen&rdquo;</strong>
              </Step>
              <Step n={3} icon={<span className="text-primary text-sm font-bold">✓</span>}>
                Tap <strong>Add</strong> — the app icon appears on your home screen instantly
              </Step>
            </>
          ) : (
            <>
              <Step n={1} icon={<MoreVertical className="h-4 w-4 text-primary" />}>
                Tap the <strong>⋮ menu</strong> (three dots) in the top-right of Chrome
              </Step>
              <Step n={2} icon={<span className="text-primary text-sm font-bold">+</span>}>
                Tap <strong>&ldquo;Add to Home screen&rdquo;</strong> or{" "}
                <strong>&ldquo;Install app&rdquo;</strong>
              </Step>
              <Step n={3} icon={<span className="text-primary text-sm font-bold">✓</span>}>
                Tap <strong>Add</strong> — you're done! Open the app from your home screen
              </Step>
            </>
          )}
        </div>

        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="w-full bg-primary text-white font-semibold text-sm rounded-xl py-3 active:opacity-80"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({
  icon,
  children,
}: {
  n?: number;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        {icon}
      </div>
      <p className="text-sm text-gray-600 leading-snug pt-1">{children}</p>
    </div>
  );
}

// ── Main banner ───────────────────────────────────────────────────────────────
export function InstallAppBanner({ restaurantName }: InstallAppBannerProps) {
  const { shouldShow, isIOS, hasNativePrompt, install } = usePwaInstall();
  const [showModal, setShowModal] = useState(false);

  if (!shouldShow) return null;

  const handleInstallClick = async () => {
    if (hasNativePrompt) {
      const outcome = await install();
      // If the prompt was dismissed or unavailable, show manual instructions
      if (outcome !== "accepted") {
        setShowModal(true);
      }
    } else {
      // No native prompt available — show how-to guide
      setShowModal(true);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2.5 px-3 py-2.5 bg-orange-50 border-b border-orange-100">
        {/* Icon */}
        <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shrink-0">
          <Download className="h-4 w-4 text-white" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-900 leading-tight truncate">
            Install {restaurantName}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">
            Add to home screen for a faster experience
          </p>
        </div>

        {/* Install button */}
        <button
          onClick={handleInstallClick}
          className="shrink-0 bg-primary text-white text-[11px] font-bold rounded-lg px-3 py-1.5 active:opacity-80 whitespace-nowrap"
        >
          Install
        </button>
      </div>

      {/* How-to modal */}
      {showModal && (
        <HowToInstallModal isIOS={isIOS} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}

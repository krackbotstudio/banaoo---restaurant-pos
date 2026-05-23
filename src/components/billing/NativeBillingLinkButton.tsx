import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button, type ButtonProps } from "@/components/ui/button";
import { isBanaooNativeApp, openBillingSettingsInBrowser, type MobileBillingSettingsTarget } from "@/lib/native-app-bridge";
import { toast } from "sonner";

type NativeBillingLinkButtonProps = ButtonProps & {
  children: ReactNode;
  /** Web route when not in native app */
  webTo: string;
  /** Browser destination after mobile session handoff */
  mobileTarget?: MobileBillingSettingsTarget;
};

/** Renders a link on web; opens system browser to billing on native app. */
export function NativeBillingLinkButton({
  children,
  webTo,
  mobileTarget = "subscription",
  onClick,
  ...buttonProps
}: NativeBillingLinkButtonProps) {
  if (!isBanaooNativeApp()) {
    return (
      <Button asChild {...buttonProps} onClick={onClick}>
        <Link to={webTo}>{children}</Link>
      </Button>
    );
  }

  return (
    <Button
      {...buttonProps}
      onClick={(e) => {
        onClick?.(e);
        void openBillingSettingsInBrowser(mobileTarget).catch((err) => {
          toast.error(err instanceof Error ? err.message : "Could not open browser");
        });
      }}
    >
      {children}
    </Button>
  );
}

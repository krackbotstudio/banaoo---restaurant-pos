import type { AddonType } from "@/lib/plans";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const BRAND_LOGO_SRC: Partial<Record<AddonType, string>> = {
  whatsapp_integration: "/brands/whatsapp.png",
  swiggy_integration: "/brands/swiggy.png",
  zomato_integration: "/brands/zomato.png",
  shiprocket_delivery: "/brands/shiprocket-icon.svg",
};

export function hasAddonBrandLogo(type: AddonType): boolean {
  return type in BRAND_LOGO_SRC;
}

interface AddonCardIconProps {
  type: AddonType;
  fallbackIcon: LucideIcon;
  className?: string;
}

export function AddonCardIcon({ type, fallbackIcon: FallbackIcon, className }: AddonCardIconProps) {
  const src = BRAND_LOGO_SRC[type];

  if (!src) {
    return <FallbackIcon className={cn("h-5 w-5 text-primary", className)} />;
  }

  return (
    <img
      src={src}
      alt=""
      className={cn(
        "h-9 w-9 rounded-lg",
        src.endsWith(".svg") ? "object-contain p-1" : "object-cover",
        className
      )}
      loading="lazy"
    />
  );
}

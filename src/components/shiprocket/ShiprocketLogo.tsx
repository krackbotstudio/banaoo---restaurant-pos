import { cn } from "@/lib/utils";

export type ShiprocketLogoVariant = "icon" | "full";

const SRC: Record<ShiprocketLogoVariant, string> = {
  icon: "/brands/shiprocket-icon.svg",
  full: "/brands/shiprocket-logo.svg",
};

interface ShiprocketLogoProps {
  variant?: ShiprocketLogoVariant;
  className?: string;
  alt?: string;
}

export function ShiprocketLogo({
  variant = "icon",
  className,
  alt = "Shiprocket",
}: ShiprocketLogoProps) {
  return (
    <img
      src={SRC[variant]}
      alt={alt}
      className={cn(
        "object-contain shrink-0",
        variant === "full" ? "h-6 w-auto max-w-[140px]" : "h-8 w-8",
        className
      )}
      loading="lazy"
    />
  );
}

import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

type BrandLogoVariant = "symbol" | "white" | "dark" | "whiteTagline" | "darkTagline";

const VARIANT_SRC: Record<BrandLogoVariant, string> = {
  symbol: BRAND.assets.symbol,
  white: BRAND.assets.logoWhite,
  dark: BRAND.assets.logoDark,
  whiteTagline: BRAND.assets.logoWhiteTagline,
  darkTagline: BRAND.assets.logoDarkTagline,
};

interface BrandLogoProps {
  /** Symbol for compact chrome; white/dark wordmarks for light/dark surfaces. */
  variant?: BrandLogoVariant;
  className?: string;
  alt?: string;
}

export function BrandLogo({
  variant = "symbol",
  className,
  alt = BRAND.name,
}: BrandLogoProps) {
  return (
    <img
      src={VARIANT_SRC[variant]}
      alt={alt}
      className={cn("object-contain", className)}
      draggable={false}
    />
  );
}

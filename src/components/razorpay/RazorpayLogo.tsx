import { cn } from "@/lib/utils";

export type RazorpayLogoVariant = "icon" | "full";

const SRC: Record<RazorpayLogoVariant, string> = {
  icon: "/brands/razorpay-icon.svg",
  full: "/brands/razorpay-logo.svg",
};

interface RazorpayLogoProps {
  variant?: RazorpayLogoVariant;
  className?: string;
  alt?: string;
}

export function RazorpayLogo({
  variant = "icon",
  className,
  alt = "Razorpay",
}: RazorpayLogoProps) {
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

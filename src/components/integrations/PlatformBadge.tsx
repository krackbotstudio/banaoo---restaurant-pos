import { Badge } from "@/components/ui/badge";

interface PlatformBadgeProps {
  source: string;
  className?: string;
}

const PLATFORM_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pos: { bg: "bg-primary/20", text: "text-primary", label: "POS" },
  zomato: { bg: "bg-red-500/20", text: "text-red-500", label: "Zomato" },
  swiggy: { bg: "bg-orange-500/20", text: "text-orange-500", label: "Swiggy" },
  uber_eats: { bg: "bg-green-600/20", text: "text-green-600", label: "Uber Eats" },
  magicpin: { bg: "bg-purple-500/20", text: "text-purple-500", label: "Magicpin" },
};

export function PlatformBadge({ source, className = "" }: PlatformBadgeProps) {
  const style = PLATFORM_STYLES[source] || PLATFORM_STYLES.pos;

  return (
    <Badge 
      variant="outline" 
      className={`${style.bg} ${style.text} border-transparent text-xs font-medium ${className}`}
    >
      {style.label}
    </Badge>
  );
}

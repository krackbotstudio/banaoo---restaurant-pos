import { Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { OrderingQRCode } from "@/components/customer/OrderingQRCode";

interface OrderingLinkRowProps {
  label: string;
  hint?: string;
  url: string;
  openPath: string;
  restaurantName: string;
  outletName?: string;
  showQr?: boolean;
}

export function OrderingLinkRow({
  label,
  hint,
  url,
  openPath,
  restaurantName,
  outletName,
  showQr,
}: OrderingLinkRowProps) {
  const copy = () => {
    void navigator.clipboard.writeText(url);
    toast.success("Link copied!");
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-foreground">
        {label}
        {hint ? <span className="text-muted-foreground font-normal"> ({hint})</span> : null}
      </p>
      <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
        <span className="text-sm font-mono text-muted-foreground truncate flex-1">{url}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          type="button"
          onClick={copy}
          title="Copy link"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          type="button"
          onClick={() => window.open(openPath, "_blank")}
          title="Open link"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </div>
      {showQr ? (
        <OrderingQRCode
          url={url}
          restaurantName={restaurantName}
          outletName={outletName}
          inline
        />
      ) : null}
    </div>
  );
}

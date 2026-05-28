import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFeatureGating } from "@/hooks/use-feature-gating";
import { useNavigate } from "react-router-dom";
import { formatOrderBillMessage, openWhatsAppChat } from "@/lib/whatsapp-bill";
import { toast } from "sonner";

export interface WhatsAppBillPayload {
  restaurantName: string;
  outletName?: string;
  orderNumber: string;
  orderType?: "dine_in" | "takeaway";
  tableNumber?: string;
  items: { name: string; quantity: number; totalPrice?: number }[];
  subtotal?: number;
  gstTotal?: number;
  grandTotal: number;
  createdAt?: Date;
}

interface WhatsAppBillButtonProps {
  payload: WhatsAppBillPayload;
  variant?: "default" | "outline" | "secondary";
  className?: string;
  size?: "default" | "sm" | "lg";
}

export function WhatsAppBillButton({
  payload,
  variant = "outline",
  className,
  size = "default",
}: WhatsAppBillButtonProps) {
  const navigate = useNavigate();
  const { canAccess } = useFeatureGating();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");

  const hasAccess = canAccess("whatsappIntegration");

  const handleOpen = () => {
    if (!hasAccess) {
      toast.error("WhatsApp integration add-on required", {
        description: "Enable it from Add-ons to send bills on WhatsApp.",
        action: {
          label: "View add-ons",
          onClick: () => navigate("/addons"),
        },
      });
      return;
    }
    setOpen(true);
  };

  const handleSend = () => {
    const trimmed = phone.trim();
    if (!trimmed) {
      toast.error("Enter customer mobile number");
      return;
    }
    const message = formatOrderBillMessage(payload);
    openWhatsAppChat(trimmed, message);
    setOpen(false);
    setPhone("");
    toast.success("Opening WhatsApp with your bill");
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={handleOpen}
      >
        <MessageCircle className="h-4 w-4 mr-2" />
        Send on WhatsApp
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send bill on WhatsApp</DialogTitle>
            <DialogDescription>
              Enter the customer&apos;s mobile number. WhatsApp opens with the bill pre-filled —
              tap send to deliver it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="wa-customer-phone">Customer mobile</Label>
            <Input
              id="wa-customer-phone"
              type="tel"
              placeholder="9876543210 or +91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Order #{payload.orderNumber} · ₹
              {payload.grandTotal.toLocaleString("en-IN")} total
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" className="gap-2" onClick={handleSend}>
              <MessageCircle className="h-4 w-4" />
              Open WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { Button } from "@/components/ui/button";
import { Copy, MessageCircle, Share2, Check } from "lucide-react";
import { useState } from "react";
import { MenuData, generateMenuUrl, createLightweightMenuData, isMenuTooLarge } from "@/lib/menu-encoder";
import { toast } from "sonner";

interface ShareButtonsProps {
  menuData: MenuData;
  savedSlug?: string | null;
}

export function ShareButtons({ menuData, savedSlug }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  
  const isValid = menuData.restaurantName && menuData.categories.some(c => c.items.some(i => i.name));
  
  // Use saved URL if available, otherwise generate from data
  const menuUrl = savedSlug 
    ? `${window.location.origin}/menu/${savedSlug}`
    : isMenuTooLarge(menuData) 
      ? generateMenuUrl(createLightweightMenuData(menuData))
      : generateMenuUrl(menuData);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(menuUrl);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const shareWhatsApp = () => {
    const text = `Check out our menu: ${menuUrl}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, "_blank");
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${menuData.restaurantName} Menu`,
          text: "Check out our menu!",
          url: menuUrl,
        });
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          toast.error("Failed to share");
        }
      }
    }
  };

  if (!isValid) return null;

  return (
    <div className="space-y-3">
      <h4 className="font-medium text-sm">Share Menu</h4>
      
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={copyLink} className="w-full" size="sm">
          {copied ? <Check className="h-4 w-4 mr-2 text-green-600" /> : <Copy className="h-4 w-4 mr-2" />}
          {copied ? "Copied!" : "Copy Link"}
        </Button>

        <Button 
          variant="outline" 
          onClick={shareWhatsApp}
          className="w-full bg-green-50 hover:bg-green-100 border-green-200 text-green-700"
          size="sm"
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          WhatsApp
        </Button>
      </div>

      {typeof navigator.share === "function" && (
        <Button variant="outline" onClick={nativeShare} className="w-full" size="sm">
          <Share2 className="h-4 w-4 mr-2" />
          More Options
        </Button>
      )}
    </div>
  );
}

import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Download, AlertTriangle } from "lucide-react";
import { MenuData, generateMenuUrl, isMenuTooLarge, getMenuUrlLength, createLightweightMenuData } from "@/lib/menu-encoder";
import { useMemo } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface QRCodeDisplayProps {
  menuData: MenuData;
  savedSlug?: string | null;
}

export function QRCodeDisplay({ menuData, savedSlug }: QRCodeDisplayProps) {
  const isValid = menuData.restaurantName && menuData.categories.some(c => c.items.some(i => i.name));
  
  const { isTooLarge, menuUrl, urlLength } = useMemo(() => {
    if (!isValid) {
      return { isTooLarge: false, menuUrl: '', urlLength: 0 };
    }
    
    // If saved, use the permanent URL
    if (savedSlug) {
      const permanentUrl = `${window.location.origin}/menu/${savedSlug}`;
      return { isTooLarge: false, menuUrl: permanentUrl, urlLength: permanentUrl.length };
    }
    
    const tooLarge = isMenuTooLarge(menuData);
    const lightweightData = createLightweightMenuData(menuData);
    const lightweightTooLarge = isMenuTooLarge(lightweightData);
    
    if (lightweightTooLarge) {
      return { 
        isTooLarge: true, 
        menuUrl: generateMenuUrl(lightweightData),
        urlLength: getMenuUrlLength(lightweightData)
      };
    }
    
    if (tooLarge) {
      return { 
        isTooLarge: true, 
        menuUrl: generateMenuUrl(lightweightData),
        urlLength: getMenuUrlLength(lightweightData)
      };
    }
    
    return { 
      isTooLarge: false, 
      menuUrl: generateMenuUrl(menuData),
      urlLength: getMenuUrlLength(menuData)
    };
  }, [menuData, isValid, savedSlug]);

  const downloadQR = () => {
    const svg = document.getElementById("qr-code-svg");
    if (!svg) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    
    img.onload = () => {
      canvas.width = 512;
      canvas.height = 512;
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
      
      const link = document.createElement("a");
      link.download = `${menuData.restaurantName || "menu"}-qr-code.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  if (!isValid) {
    return (
      <div className="text-center py-8">
        <div className="w-32 h-32 mx-auto border-2 border-dashed rounded-lg flex items-center justify-center mb-3">
          <span className="text-muted-foreground text-sm">QR Code</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Add a restaurant name and at least one item to generate QR code
        </p>
      </div>
    );
  }

  if (urlLength > 2500 && !savedSlug) {
    return (
      <div className="text-center py-8">
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Menu has too many items for QR code. Save your menu to get a permanent short link.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="text-center space-y-4">
      {isTooLarge && !savedSlug && (
        <Alert className="text-left">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Images excluded from QR code due to size limits. Save menu to include images.
          </AlertDescription>
        </Alert>
      )}
      
      <div className="bg-white p-4 rounded-lg inline-block">
        <QRCodeSVG
          id="qr-code-svg"
          value={menuUrl}
          size={180}
          level="L"
          includeMargin={true}
        />
      </div>

      <Button onClick={downloadQR} className="w-full">
        <Download className="h-4 w-4 mr-2" />
        Download QR Code
      </Button>
    </div>
  );
}

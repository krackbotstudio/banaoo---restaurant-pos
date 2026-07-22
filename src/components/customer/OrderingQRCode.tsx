import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { QrCode, Download, Printer } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface OrderingQRCodeProps {
  url: string;
  restaurantName: string;
  outletName?: string;
  /** Always show scannable QR (recommended for mobile app / WebView) */
  inline?: boolean;
}

function useQrExport(svgRef: React.RefObject<SVGSVGElement | null>, fileLabel: string, url: string) {
  const downloadQR = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
      }
      const link = document.createElement("a");
      link.download = `${fileLabel}-ordering-qr.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const printQR = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>QR Code – ${fileLabel}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; background: #fff;
    }
    .card {
      border: 2px solid #e5e7eb; border-radius: 20px;
      padding: 40px 48px; display: flex; flex-direction: column;
      align-items: center; gap: 20px; text-align: center;
    }
    svg { display: block; }
    .name { font-size: 24px; font-weight: 700; color: #111827; }
    .cta { font-size: 14px; font-weight: 600; color: #FF4500; margin-top: 8px; }
    .url { font-size: 10px; color: #9ca3af; margin-top: 6px; word-break: break-all; max-width: 260px; }
  </style>
</head>
<body>
  <div class="card">
    ${svgData}
    <div class="name">${fileLabel}</div>
    <div class="cta">Scan to Order Online</div>
    <div class="url">${url}</div>
  </div>
  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`);
    win.document.close();
  };

  return { downloadQR, printQR };
}

function QRCodePanel({
  url,
  restaurantName,
  outletName,
  svgRef,
  qrSize,
}: {
  url: string;
  restaurantName: string;
  outletName?: string;
  svgRef: React.RefObject<SVGSVGElement | null>;
  qrSize: number;
}) {
  const label = outletName && outletName !== restaurantName ? outletName : null;
  const fileLabel = label || restaurantName;
  const { downloadQR, printQR } = useQrExport(svgRef, fileLabel, url);

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">Scan to order</p>
      <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
        <QRCodeSVG ref={svgRef} value={url} size={qrSize} level="M" includeMargin />
      </div>
      <div className="text-center">
        <p className="font-semibold text-sm">{restaurantName}</p>
        {label ? <p className="text-xs text-muted-foreground mt-0.5">{label}</p> : null}
        <p className="text-xs text-primary font-semibold mt-1">Scan to Order Online</p>
      </div>
      <div className="flex gap-2 w-full max-w-xs">
        <Button variant="outline" className="flex-1 gap-1.5 text-xs" type="button" onClick={downloadQR}>
          <Download className="h-3.5 w-3.5" />
          Download
        </Button>
        <Button variant="outline" className="flex-1 gap-1.5 text-xs" type="button" onClick={printQR}>
          <Printer className="h-3.5 w-3.5" />
          Print
        </Button>
      </div>
    </div>
  );
}

export function OrderingQRCode({ url, restaurantName, outletName, inline = false }: OrderingQRCodeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const isMobile = useIsMobile();
  const qrSize = isMobile ? 168 : 200;

  if (inline) {
    return (
      <QRCodePanel
        url={url}
        restaurantName={restaurantName}
        outletName={outletName}
        svgRef={svgRef}
        qrSize={qrSize}
      />
    );
  }

  const panel = (
    <QRCodePanel
      url={url}
      restaurantName={restaurantName}
      outletName={outletName}
      svgRef={svgRef}
      qrSize={qrSize}
    />
  );

  const trigger = (
    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" type="button" title="QR Code">
      <QrCode className="h-3.5 w-3.5" />
    </Button>
  );

  if (isMobile) {
    return (
      <Drawer>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent className="z-[100]">
          <DrawerHeader>
            <DrawerTitle>Ordering QR Code</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-8">{panel}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-xs z-[100]">
        <DialogHeader>
          <DialogTitle className="text-base">Ordering QR Code</DialogTitle>
        </DialogHeader>
        {panel}
      </DialogContent>
    </Dialog>
  );
}

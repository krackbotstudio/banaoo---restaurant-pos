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
import { QrCode, Download, Printer } from "lucide-react";

interface OrderingQRCodeProps {
  url: string;
  restaurantName: string;
  /** Optional sub-label (e.g. outlet name when different from brand name) */
  outletName?: string;
}

export function OrderingQRCode({ url, restaurantName, outletName }: OrderingQRCodeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const label = outletName && outletName !== restaurantName ? outletName : null;

  const getSvgElement = () => svgRef.current;

  const downloadQR = () => {
    const svg = getSvgElement();
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
      link.download = `${label || restaurantName}-ordering-qr.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src =
      "data:image/svg+xml;base64," +
      btoa(unescape(encodeURIComponent(svgData)));
  };

  const printQR = () => {
    const svg = getSvgElement();
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>QR Code – ${label || restaurantName}</title>
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
    .outlet { font-size: 15px; color: #6b7280; margin-top: 4px; }
    .cta {
      font-size: 14px; font-weight: 600; color: #f97316;
      border: 1.5px solid #fed7aa; border-radius: 999px;
      padding: 6px 20px; margin-top: 4px;
    }
    .url { font-size: 10px; color: #9ca3af; margin-top: 6px; word-break: break-all; max-width: 260px; }
    @media print {
      body { min-height: unset; }
      .card { border-color: #d1d5db; }
    }
  </style>
</head>
<body>
  <div class="card">
    ${svgData}
    <div>
      <div class="name">${restaurantName}</div>
      ${label ? `<div class="outlet">${label}</div>` : ""}
      <div class="cta">Scan to Order Online</div>
      <div class="url">${url}</div>
    </div>
  </div>
  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`);
    win.document.close();
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" title="QR Code">
          <QrCode className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-base">Ordering QR Code</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {/* QR code */}
          <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
            <QRCodeSVG
              ref={svgRef}
              value={url}
              size={200}
              level="M"
              includeMargin
            />
          </div>

          {/* Labels */}
          <div className="text-center">
            <p className="font-semibold text-sm text-gray-900">{restaurantName}</p>
            {label && <p className="text-xs text-gray-500 mt-0.5">{label}</p>}
            <p className="text-xs text-orange-500 font-semibold mt-1">Scan to Order Online</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1 gap-1.5 text-xs" onClick={downloadQR}>
              <Download className="h-3.5 w-3.5" />
              Download
            </Button>
            <Button variant="outline" className="flex-1 gap-1.5 text-xs" onClick={printQR}>
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
          </div>

          <p className="text-[11px] text-gray-400 text-center leading-relaxed">
            Print and place at your tables, counter, or entrance so customers can scan and order directly.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

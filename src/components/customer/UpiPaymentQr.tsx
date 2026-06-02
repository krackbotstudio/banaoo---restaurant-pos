import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { resolveImageUrl } from "@/lib/image-url";

interface UpiPaymentQrProps {
  payUrl: string;
  uploadedQrUrl?: string | null;
}

export function UpiPaymentQr({ payUrl, uploadedQrUrl }: UpiPaymentQrProps) {
  const [uploadFailed, setUploadFailed] = useState(false);
  const staticSrc = uploadedQrUrl?.trim() ? resolveImageUrl(uploadedQrUrl) : "";
  const showStatic = !!staticSrc && !uploadFailed;

  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 flex flex-col items-center gap-3">
      <QRCodeSVG value={payUrl} size={192} level="M" includeMargin className="rounded-lg" />
      <p className="text-xs text-gray-500">Scan with any UPI app · amount prefilled</p>
      {showStatic ? (
        <>
          <p className="text-xs text-gray-400">Or use restaurant QR</p>
          <img
            src={staticSrc}
            alt="Restaurant UPI QR"
            className="w-40 h-40 object-contain rounded-lg border border-gray-100"
            onError={() => setUploadFailed(true)}
          />
        </>
      ) : null}
    </div>
  );
}

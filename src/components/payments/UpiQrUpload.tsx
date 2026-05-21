import { useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, QrCode, Trash2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_URL = import.meta.env.VITE_API_URL ?? "";

interface UpiQrUploadProps {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

export function UpiQrUpload({ value, onChange, disabled }: UpiQrUploadProps) {
  const { getImageUrl } = useAuth();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ variant: "destructive", title: "Invalid file", description: "Please upload an image (PNG, JPG, WebP)" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Maximum size is 2 MB" });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onChange(data.url);
      toast({ title: "QR code uploaded" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const previewUrl = value ? getImageUrl(value) : "";

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <QrCode className="h-3.5 w-3.5" />
        UPI QR code (optional)
      </Label>
      <p className="text-xs text-muted-foreground">
        Upload your static UPI QR image. Shown on the customer payment screen when they pay online.
      </p>

      <div className="flex items-start gap-4">
        <div className="h-28 w-28 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden shrink-0">
          {previewUrl ? (
            <img src={previewUrl} alt="UPI QR preview" className="h-full w-full object-contain p-1" />
          ) : (
            <QrCode className="h-10 w-10 text-muted-foreground/50" />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className={disabled ? "pointer-events-none opacity-50" : "cursor-pointer"}>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-input bg-background hover:bg-accent text-sm font-medium transition-colors">
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {uploading ? "Uploading…" : value ? "Replace QR" : "Upload QR image"}
            </span>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={disabled || uploading}
              onChange={handleUpload}
            />
          </label>
          <p className="text-xs text-muted-foreground">PNG, JPG or WebP · max 2 MB</p>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive justify-start px-0 h-8"
              disabled={disabled}
              onClick={() => onChange("")}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Remove QR
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

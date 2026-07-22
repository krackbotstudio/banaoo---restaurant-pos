import { useEffect, useState } from "react";
import { ImageIcon, Loader2, Save, Upload } from "lucide-react";
import { API_URL } from "@/lib/api-url";
import { resolveImageUrl } from "@/lib/image-url";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface BrandingState {
  brand_name?: string | null;
  brand_color?: string | null;
  logo_url?: string | null;
  ordering_slug?: string | null;
  app_theme?: string | null;
}

interface Props {
  userId: string;
  branding: BrandingState;
  onSaved: () => void;
}

export function CmsCustomerBrandingPanel({ userId, branding, onSaved }: Props) {
  const [form, setForm] = useState({
    brand_name: branding.brand_name || "",
    brand_color: branding.brand_color || "#FF4500",
    logo_url: branding.logo_url || "",
    ordering_slug: branding.ordering_slug || "",
    app_theme: branding.app_theme === "dark" ? "dark" : "light",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setForm({
      brand_name: branding.brand_name || "",
      brand_color: branding.brand_color || "#FF4500",
      logo_url: branding.logo_url || "",
      ordering_slug: branding.ordering_slug || "",
      app_theme: branding.app_theme === "dark" ? "dark" : "light",
    });
  }, [branding]);

  const uploadLogo = async (file: File) => {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        credentials: "include",
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setForm((s) => ({ ...s, logo_url: data.url }));
      toast.success("Logo uploaded — click Save branding to apply");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/cms/customers/${userId}/branding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          brand_name: form.brand_name.trim() || null,
          brand_color: form.brand_color || null,
          logo_url: form.logo_url || null,
          ordering_slug: form.ordering_slug.trim() || null,
          app_theme: form.app_theme,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save branding");
      toast.success("Branding updated");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save branding");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding</CardTitle>
        <CardDescription>Customer-facing brand identity for ordering and dashboard</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          <Label>Logo</Label>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl border border-dashed flex items-center justify-center overflow-hidden bg-muted/30 shrink-0">
              {form.logo_url ? (
                <img
                  src={resolveImageUrl(form.logo_url)}
                  alt="Logo"
                  className="h-full w-full object-contain"
                />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm cursor-pointer hover:bg-accent">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? "Uploading…" : "Upload logo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
                  className="sr-only"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadLogo(file);
                    e.target.value = "";
                  }}
                />
              </label>
              {form.logo_url && (
                <button
                  type="button"
                  className="block text-xs text-destructive hover:underline"
                  onClick={() => setForm((s) => ({ ...s, logo_url: "" }))}
                >
                  Remove logo
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cms-brand-name">Brand name</Label>
            <Input
              id="cms-brand-name"
              value={form.brand_name}
              onChange={(e) => setForm((s) => ({ ...s, brand_name: e.target.value }))}
              placeholder="Restaurant / brand name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cms-ordering-slug">Ordering slug</Label>
            <Input
              id="cms-ordering-slug"
              value={form.ordering_slug}
              onChange={(e) => setForm((s) => ({ ...s, ordering_slug: e.target.value }))}
              placeholder="nite-bliss"
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label>Brand color</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.brand_color || "#FF4500"}
                onChange={(e) => setForm((s) => ({ ...s, brand_color: e.target.value }))}
                className="h-10 w-12 rounded border cursor-pointer"
              />
              <Input
                value={form.brand_color}
                onChange={(e) => setForm((s) => ({ ...s, brand_color: e.target.value }))}
                className="font-mono"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Dashboard theme</Label>
            <Select
              value={form.app_theme}
              onValueChange={(v) => setForm((s) => ({ ...s, app_theme: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">light</SelectItem>
                <SelectItem value="dark">dark</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={() => void save()} disabled={saving || uploading}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          Save branding
        </Button>
      </CardContent>
    </Card>
  );
}

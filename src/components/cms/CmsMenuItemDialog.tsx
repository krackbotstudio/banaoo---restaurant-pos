import { useEffect, useRef, useState } from "react";
import {
  Camera,
  ImageIcon,
  IndianRupee,
  Loader2,
  Percent,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { API_URL } from "@/lib/api-url";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AvailabilityScheduleSection } from "@/components/menu/AvailabilityScheduleSection";
import { GST_CATEGORIES } from "@/lib/gst-categories";
import {
  buildSchedulePayload,
  emptySchedule,
  parseAvailabilitySchedule,
  type AvailabilitySchedule,
} from "@/lib/menu-availability";

const SPECIAL_LABELS = ["Today's Special", "Chef's Pick", "Must Try", "New"];
const GST_NONE = "__none__";

export interface CmsMenuVariant {
  id?: string;
  menu_item_id?: string;
  name: string;
  price_adjustment: number;
  is_default: boolean;
}

export interface CmsMenuItemRecord {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  base_price: number;
  image_url: string | null;
  is_veg: boolean;
  is_available: boolean;
  prep_time_mins?: number | null;
  is_special?: boolean;
  special_label?: string;
  offer_label?: string | null;
  offer_price?: number | null;
  gst_category?: string | null;
  schedule_enabled?: boolean;
  availability_schedule?: unknown;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outletId: string;
  categories: { id: string; name: string }[];
  item: CmsMenuItemRecord | null;
  variants?: CmsMenuVariant[];
  onSaved: () => void;
}

function resolveImageSrc(url: string | null) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

const emptyVariant = (): CmsMenuVariant => ({
  name: "",
  price_adjustment: 0,
  is_default: false,
});

export function CmsMenuItemDialog({
  open,
  onOpenChange,
  outletId,
  categories,
  item,
  variants: initialVariants = [],
  onSaved,
}: Props) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [fetchingImages, setFetchingImages] = useState(false);
  const [stockImages, setStockImages] = useState<{ url: string; thumb: string; source: string }[]>([]);
  const [showImagePicker, setShowImagePicker] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [isVeg, setIsVeg] = useState(true);
  const [isAvailable, setIsAvailable] = useState(true);
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [gstCategory, setGstCategory] = useState(GST_NONE);
  const [isSpecial, setIsSpecial] = useState(false);
  const [specialLabel, setSpecialLabel] = useState(SPECIAL_LABELS[0]);
  const [hasOffer, setHasOffer] = useState(false);
  const [offerLabel, setOfferLabel] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [schedule, setSchedule] = useState<AvailabilitySchedule>(emptySchedule());
  const [variants, setVariants] = useState<CmsMenuVariant[]>([]);

  useEffect(() => {
    if (!open) return;
    if (item) {
      setName(item.name);
      setDescription(item.description || "");
      setBasePrice(String(item.base_price));
      setCategoryId(item.category_id || "");
      setIsVeg(item.is_veg);
      setIsAvailable(item.is_available);
      setImageUrl(item.image_url || "");
      setImagePreview(resolveImageSrc(item.image_url));
      setGstCategory(item.gst_category || GST_NONE);
      setIsSpecial(!!item.is_special);
      setSpecialLabel(item.special_label || SPECIAL_LABELS[0]);
      setHasOffer(!!(item.offer_label || item.offer_price));
      setOfferLabel(item.offer_label || "");
      setOfferPrice(item.offer_price != null ? String(item.offer_price) : "");
      setScheduleEnabled(item.schedule_enabled ?? false);
      setSchedule(
        parseAvailabilitySchedule(item.availability_schedule) ?? emptySchedule()
      );
      setVariants(
        initialVariants.length
          ? initialVariants.map((v) => ({ ...v }))
          : []
      );
    } else {
      setName("");
      setDescription("");
      setBasePrice("");
      setCategoryId("");
      setIsVeg(true);
      setIsAvailable(true);
      setImageUrl("");
      setImagePreview("");
      setGstCategory(GST_NONE);
      setIsSpecial(false);
      setSpecialLabel(SPECIAL_LABELS[0]);
      setHasOffer(false);
      setOfferLabel("");
      setOfferPrice("");
      setScheduleEnabled(false);
      setSchedule(emptySchedule());
      setVariants([]);
    }
    setStockImages([]);
    setShowImagePicker(false);
  }, [open, item, initialVariants]);

  const buildPayload = () => {
    const price = parseFloat(basePrice);
    if (!name.trim() || !Number.isFinite(price) || price < 0) {
      throw new Error("Name and valid price are required");
    }
    if (hasOffer && offerPrice && parseFloat(offerPrice) >= price) {
      throw new Error("Offer price must be less than base price");
    }
    return {
      name: name.trim(),
      description: description.trim() || null,
      base_price: price,
      category_id: categoryId || null,
      is_veg: isVeg,
      is_available: isAvailable,
      image_url: imageUrl || null,
      gst_category: gstCategory === GST_NONE ? null : gstCategory,
      is_special: isSpecial,
      special_label: specialLabel,
      offer_label: hasOffer && offerLabel.trim() ? offerLabel.trim() : null,
      offer_price: hasOffer && offerPrice ? parseFloat(offerPrice) : null,
      variants: variants
        .filter((v) => v.name.trim())
        .map((v) => ({
          name: v.name.trim(),
          price_adjustment: Number(v.price_adjustment) || 0,
          is_default: v.is_default,
        })),
      ...buildSchedulePayload(scheduleEnabled, schedule),
    };
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = buildPayload();
      const url = item
        ? `${API_URL}/api/cms/outlets/${outletId}/menu/items/${item.id}`
        : `${API_URL}/api/cms/outlets/${outletId}/menu/items`;
      const res = await fetch(url, {
        method: item ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save item");
      toast.success(item ? "Item updated" : "Item created");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save item");
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setImageUrl(data.url);
      setImagePreview(resolveImageSrc(data.url));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFindPhotos = async () => {
    if (!name.trim()) {
      toast.error("Enter item name first to search photos");
      return;
    }
    setFetchingImages(true);
    setShowImagePicker(true);
    try {
      const res = await fetch(`${API_URL}/api/generate-menu-image`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to find photos");
      setStockImages(
        (data.photos ?? []).map((p: { url: string; thumb: string; source: string }) => ({
          url: p.url,
          thumb: p.thumb || p.url,
          source: p.source || "Stock",
        }))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to find photos");
    } finally {
      setFetchingImages(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Edit menu item" : "Add menu item"}</DialogTitle>
          <DialogDescription>Full menu fields — saved to this customer&apos;s outlet.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          <div className="space-y-2">
            <Label>Item photo</Label>
            <div className="relative w-full h-32 rounded-lg border-2 border-dashed overflow-hidden bg-muted/30">
              {imagePreview ? (
                <>
                  <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 hover:opacity-100 bg-black/40 transition-opacity">
                    <Button type="button" size="sm" variant="secondary" onClick={() => void handleFindPhotos()}>
                      <Search className="h-3.5 w-3.5 mr-1" /> Find
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => imageInputRef.current?.click()}>
                      <Camera className="h-3.5 w-3.5 mr-1" /> Upload
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      className="h-8 w-8"
                      onClick={() => {
                        setImageUrl("");
                        setImagePreview("");
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => imageInputRef.current?.click()}>
                      Upload
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => void handleFindPhotos()}>
                      Find photos
                    </Button>
                  </div>
                </div>
              )}
              {uploadingImage && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </div>
              )}
            </div>
            {showImagePicker && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-xs text-muted-foreground">
                    {fetchingImages ? "Searching…" : `${stockImages.length} photos`}
                  </p>
                  <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => void handleFindPhotos()}>
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {stockImages.map((photo, i) => (
                    <button
                      key={i}
                      type="button"
                      className="h-14 rounded overflow-hidden ring-1 hover:ring-2 ring-primary"
                      onClick={() => {
                        setImageUrl(photo.url);
                        setImagePreview(photo.url);
                        setShowImagePicker(false);
                      }}
                    >
                      <img src={photo.thumb} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImageUpload(f);
              }}
            />
          </div>

          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Price (₹)</Label>
              <Input type="number" min={0} step="0.01" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={categoryId || "_none"} onValueChange={(v) => setCategoryId(v === "_none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>GST category</Label>
            <Select value={gstCategory} onValueChange={setGstCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={GST_NONE}>None</SelectItem>
                {GST_CATEGORIES.map((g) => (
                  <SelectItem key={g.key} value={g.key}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label>Vegetarian</Label>
            <Switch checked={isVeg} onCheckedChange={setIsVeg} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Available</Label>
            <Switch checked={isAvailable} onCheckedChange={setIsAvailable} />
          </div>

          <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-1">
                <Star className="h-4 w-4 text-amber-500" /> Special
              </span>
              <Switch checked={isSpecial} onCheckedChange={setIsSpecial} />
            </div>
            {isSpecial && (
              <Select value={specialLabel} onValueChange={setSpecialLabel}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPECIAL_LABELS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2 rounded-lg border border-green-200 bg-green-50/50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-1">
                <Percent className="h-4 w-4 text-green-600" /> Offer
              </span>
              <Switch checked={hasOffer} onCheckedChange={setHasOffer} />
            </div>
            {hasOffer && (
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder='e.g. "20% OFF"' value={offerLabel} onChange={(e) => setOfferLabel(e.target.value)} />
                <div className="relative">
                  <IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="number"
                    className="pl-7"
                    placeholder="Offer price"
                    value={offerPrice}
                    onChange={(e) => setOfferPrice(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <AvailabilityScheduleSection
            scheduleEnabled={scheduleEnabled}
            onScheduleEnabledChange={setScheduleEnabled}
            schedule={schedule}
            onScheduleChange={setSchedule}
          />

          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center justify-between">
              <Label>Size / variants</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setVariants((v) => [...v, emptyVariant()])}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add variant
              </Button>
            </div>
            {variants.map((v, idx) => (
              <div key={idx} className="flex gap-2 items-end">
                <Input
                  placeholder="e.g. Half / Full"
                  value={v.name}
                  onChange={(e) =>
                    setVariants((arr) =>
                      arr.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x))
                    )
                  }
                  className="flex-1"
                />
                <Input
                  type="number"
                  placeholder="+₹"
                  className="w-20"
                  value={v.price_adjustment}
                  onChange={(e) =>
                    setVariants((arr) =>
                      arr.map((x, i) =>
                        i === idx ? { ...x, price_adjustment: Number(e.target.value) || 0 } : x
                      )
                    )
                  }
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setVariants((arr) => arr.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : item ? "Save changes" : "Create item"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

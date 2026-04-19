import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useOutlet } from "@/lib/outlet-context";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, UtensilsCrossed, Leaf, Flame, Tag, IndianRupee, Trash2, Camera, Search, X, ImageIcon, Star, Percent, RefreshCw } from "lucide-react";
import { GST_CATEGORIES } from "@/lib/gst-categories";
import { MenuImportDialog } from "@/components/MenuImportDialog";

interface Category {
  id: string;
  name: string;
  outlet_id: string;
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  is_veg: boolean;
  is_available: boolean;
  category_id: string | null;
  outlet_id: string;
  image_url: string | null;
  is_special: boolean;
  special_label: string;
  offer_label: string | null;
  offer_price: number | null;
  gst_category: string | null;
}

const SPECIAL_LABELS = ["Today's Special", "Chef's Pick", "Must Try", "New"];

export default function Menu() {
  const { user, getImageUrl } = useAuth();
  const { toast } = useToast();
  const { currentOutlet, loading: outletLoading } = useOutlet();
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [vegFilter, setVegFilter] = useState<boolean | null>(null);

  // Item form state
  const [itemName, setItemName] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemIsVeg, setItemIsVeg] = useState(true);
  const [itemIsAvailable, setItemIsAvailable] = useState(true);
  const [itemCategory, setItemCategory] = useState("");
  const [itemImageUrl, setItemImageUrl] = useState("");
  const [itemImagePreview, setItemImagePreview] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [fetchingImages, setFetchingImages] = useState(false);
  const [stockImages, setStockImages] = useState<{ url: string; thumb: string; source: string }[]>([]);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const GST_NONE = "__none__";
  const [itemGstCategory, setItemGstCategory] = useState(GST_NONE);

  // Special & Offer form state
  const [itemIsSpecial, setItemIsSpecial] = useState(false);
  const [itemSpecialLabel, setItemSpecialLabel] = useState("Today's Special");
  const [itemHasOffer, setItemHasOffer] = useState(false);
  const [itemOfferLabel, setItemOfferLabel] = useState("");
  const [itemOfferPrice, setItemOfferPrice] = useState("");

  const imageInputRef = useRef<HTMLInputElement>(null);

  // Category form
  const [categoryName, setCategoryName] = useState("");

  useEffect(() => {
    if (currentOutlet?.id) {
      setLoading(true);
      fetchCategories();
      fetchMenuItems();
    }
  }, [currentOutlet?.id]);

  const fetchCategories = async () => {
    if (!currentOutlet?.id) return;
    const { data, error } = await supabase
      .from("menu_categories")
      .select("*")
      .eq("outlet_id", currentOutlet.id)
      .order("sort_order");
    
    if (error) {
      console.error("Error fetching categories:", error);
      return;
    }
    setCategories(data || []);
  };

  const fetchMenuItems = async () => {
    if (!currentOutlet?.id) return;
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .eq("outlet_id", currentOutlet.id)
      .order("name");

    if (error) {
      console.error("Error fetching menu items:", error);
      toast({ variant: "destructive", title: "Error", description: error.message });
      setLoading(false);
      return;
    }
    setMenuItems(data || []);
    setLoading(false);
  };

  const resetItemForm = () => {
    setItemName("");
    setItemDescription("");
    setItemPrice("");
    setItemIsVeg(true);
    setItemIsAvailable(true);
    setItemCategory("");
    setItemGstCategory(GST_NONE);
    setItemImageUrl("");
    setItemImagePreview("");
    setStockImages([]);
    setShowImagePicker(false);
    setItemIsSpecial(false);
    setItemSpecialLabel("Today's Special");
    setItemHasOffer(false);
    setItemOfferLabel("");
    setItemOfferPrice("");
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = "";

    setItemImagePreview(URL.createObjectURL(file));
    setUploadingImage(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const API_URL = import.meta.env.VITE_API_URL ?? "";
      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      
      setItemImageUrl(data.url);
      toast({ title: "Photo uploaded" });
    } catch {
      toast({ variant: "destructive", title: "Upload failed", description: "Please try again" });
      setItemImagePreview(itemImageUrl);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFindPhotos = async () => {
    if (!itemName.trim()) {
      toast({ variant: "destructive", title: "Enter item name first" });
      return;
    }
    setFetchingImages(true);
    setShowImagePicker(true);
    setStockImages([]);
    try {
      const API_URL = import.meta.env.VITE_API_URL ?? "";
      const response = await fetch(`${API_URL}/api/generate-menu-image`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_name: itemName })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch images');
      setStockImages(data.photos || []);
      if (!data.photos?.length) {
        toast({ variant: "destructive", title: "No photos found", description: "Try a different name or upload manually" });
        setShowImagePicker(false);
      }
    } catch {
      toast({ variant: "destructive", title: "Could not fetch photos", description: "Please try again or upload manually" });
      setShowImagePicker(false);
    } finally {
      setFetchingImages(false);
    }
  };

  const selectStockPhoto = (photo: { url: string; thumb: string }) => {
    setItemImageUrl(photo.url);
    setItemImagePreview(photo.url);
    setShowImagePicker(false);
    setStockImages([]);
  };

  const handleRemoveImage = () => {
    setItemImageUrl("");
    setItemImagePreview("");
  };

  // Silently fetch and assign an image for an item that has none
  const autoAssignImage = async (itemName: string, outletId: string, onDone?: () => void) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL ?? "";
      const response = await fetch(`${API_URL}/api/generate-menu-image`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_name: itemName })
      });
      const data = await response.json();
      const firstPhoto = data?.photos?.[0];
      if (firstPhoto) {
        await supabase
          .from("menu_items")
          .update({ image_url: firstPhoto.url })
          .eq("outlet_id", outletId)
          .eq("name", itemName)
          .is("image_url", null); // only if still unset
        onDone?.();
      }
    } catch {
      // silent — image is optional
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim() || !currentOutlet?.id) return;

    setIsSubmitting(true);
    const { error } = await supabase.from("menu_categories").insert({
      name: categoryName.trim(),
      outlet_id: currentOutlet.id,
    });
    setIsSubmitting(false);

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Success!", description: "Category created" });
      setCategoryName("");
      setIsCategoryDialogOpen(false);
      fetchCategories();
    }
  };

  const buildItemPayload = () => ({
    name: itemName.trim(),
    description: itemDescription.trim() || null,
    base_price: parseFloat(itemPrice),
    is_veg: itemIsVeg,
    category_id: itemCategory || null,
    gst_category: itemGstCategory && itemGstCategory !== GST_NONE ? itemGstCategory : null,
    image_url: itemImageUrl || null,
    is_special: itemIsSpecial,
    special_label: itemSpecialLabel,
    offer_label: itemHasOffer && itemOfferLabel.trim() ? itemOfferLabel.trim() : null,
    offer_price: itemHasOffer && itemOfferPrice ? parseFloat(itemOfferPrice) : null,
  });

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !itemPrice || !currentOutlet?.id) {
      toast({ variant: "destructive", title: "Validation Error", description: "Name and price are required" });
      return;
    }
    if (itemHasOffer && itemOfferPrice && parseFloat(itemOfferPrice) >= parseFloat(itemPrice)) {
      toast({ variant: "destructive", title: "Validation Error", description: "Offer price must be less than the original price" });
      return;
    }

    setIsSubmitting(true);
    const noImage = !itemImageUrl;
    const savedName = itemName.trim();
    const { error } = await supabase.from("menu_items").insert({
      ...buildItemPayload(),
      outlet_id: currentOutlet!.id,
    });
    setIsSubmitting(false);

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Success!", description: "Menu item created" });
      resetItemForm();
      setIsItemDialogOpen(false);
      fetchMenuItems();
      // Auto-assign image in background if none was set manually
      if (noImage) {
        autoAssignImage(savedName, savedOutlet, fetchMenuItems);
      }
    }
  };

  const openEditDialog = (item: MenuItem) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemDescription(item.description || "");
    setItemPrice(item.base_price.toString());
    setItemIsVeg(item.is_veg);
    setItemIsAvailable(item.is_available);
    setItemCategory(item.category_id || "");
    setItemGstCategory(item.gst_category || GST_NONE);
    setItemImageUrl(item.image_url || "");
    setItemImagePreview(item.image_url || "");
    setItemIsSpecial(item.is_special ?? false);
    setItemSpecialLabel(item.special_label || "Today's Special");
    setItemHasOffer(!!(item.offer_label || item.offer_price));
    setItemOfferLabel(item.offer_label || "");
    setItemOfferPrice(item.offer_price?.toString() || "");
    setIsEditDialogOpen(true);
  };

  const closeEditDialog = () => {
    setIsEditDialogOpen(false);
    setEditingItem(null);
    resetItemForm();
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !itemName.trim() || !itemPrice) {
      toast({ variant: "destructive", title: "Validation Error", description: "Name and price are required" });
      return;
    }
    if (itemHasOffer && itemOfferPrice && parseFloat(itemOfferPrice) >= parseFloat(itemPrice)) {
      toast({ variant: "destructive", title: "Validation Error", description: "Offer price must be less than the original price" });
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase
      .from("menu_items")
      .update({ ...buildItemPayload(), is_available: itemIsAvailable })
      .eq("id", editingItem.id);
    setIsSubmitting(false);

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Success!", description: "Menu item updated" });
      closeEditDialog();
      fetchMenuItems();
    }
  };

  const handleDeleteItem = async () => {
    if (!editingItem) return;
    if (!confirm("Are you sure you want to delete this item?")) return;

    const { error } = await supabase.from("menu_items").delete().eq("id", editingItem.id);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      toast({ title: "Deleted", description: "Menu item deleted" });
      closeEditDialog();
      fetchMenuItems();
    }
  };

  // Shared image upload UI
  const ImageUploadSection = () => (
    <div className="space-y-2">
      <Label>Item Photo</Label>
      <div className="relative w-full h-36 rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 overflow-hidden">
        {itemImagePreview ? (
          <>
            <img src={itemImagePreview} alt="Preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 hover:bg-black/50 transition-colors flex items-center justify-center gap-2 opacity-0 hover:opacity-100">
              <Button type="button" size="sm" variant="secondary" className="h-8"
                onClick={handleFindPhotos}
                disabled={uploadingImage || fetchingImages}>
                <Search className="h-3.5 w-3.5 mr-1" /> Find Photos
              </Button>
              <Button type="button" size="sm" variant="secondary" className="h-8"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploadingImage || fetchingImages}>
                <Camera className="h-3.5 w-3.5 mr-1" /> Upload
              </Button>
              <Button type="button" size="icon" variant="destructive" className="h-8 w-8"
                onClick={handleRemoveImage}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            {uploadingImage && (
              <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
                <p className="text-xs text-white">Uploading…</p>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2.5 p-4">
            {uploadingImage ? (
              <>
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Uploading photo…</p>
              </>
            ) : (
              <>
                <ImageIcon className="h-7 w-7 text-muted-foreground/40" />
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" className="h-8"
                    onClick={() => imageInputRef.current?.click()}>
                    <Camera className="h-3.5 w-3.5 mr-1.5" /> Upload Photo
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="h-8"
                    onClick={handleFindPhotos}
                    disabled={fetchingImages}>
                    {fetchingImages
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      : <Search className="h-3.5 w-3.5 mr-1.5" />}
                    Find Photos
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Stock photo picker grid */}
      {showImagePicker && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {fetchingImages ? "Searching…" : `${stockImages.length} photos found — click to use`}
            </p>
            <div className="flex gap-1">
              <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs"
                onClick={handleFindPhotos} disabled={fetchingImages}>
                <RefreshCw className="h-3 w-3 mr-1" /> Refresh
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs"
                onClick={() => { setShowImagePicker(false); setStockImages([]); }}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
          {fetchingImages ? (
            <div className="grid grid-cols-4 gap-1.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1.5">
              {stockImages.map((photo, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectStockPhoto(photo)}
                  className="relative h-16 rounded-lg overflow-hidden ring-1 ring-border hover:ring-2 hover:ring-primary transition-all focus:outline-none focus:ring-2 focus:ring-primary"
                  title={`Photo from ${photo.source}`}
                >
                  <img src={photo.thumb} alt="" className="w-full h-full object-cover" />
                  <span className="absolute bottom-0 right-0 text-[8px] bg-black/50 text-white px-1 py-0.5 rounded-tl">
                    {photo.source}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleImageFileChange}
      />
    </div>
  );

  // Special & Offer section shared between add/edit dialogs
  const SpecialsOfferSection = () => (
    <div className="space-y-3 pt-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Specials & Offers</p>

      {/* Special toggle */}
      <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium">Mark as Special</span>
          </div>
          <Switch checked={itemIsSpecial} onCheckedChange={setItemIsSpecial} />
        </div>
        {itemIsSpecial && (
          <Select value={itemSpecialLabel} onValueChange={setItemSpecialLabel}>
            <SelectTrigger className="h-9 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPECIAL_LABELS.map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Offer toggle */}
      <div className="rounded-lg border border-green-200 bg-green-50/60 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium">Add Offer / Discount</span>
          </div>
          <Switch checked={itemHasOffer} onCheckedChange={setItemHasOffer} />
        </div>
        {itemHasOffer && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Offer Label</Label>
              <Input
                placeholder='e.g. "20% OFF"'
                value={itemOfferLabel}
                onChange={(e) => setItemOfferLabel(e.target.value)}
                className="h-9 bg-white text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Offer Price (₹)</Label>
              <div className="relative">
                <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="0.00"
                  value={itemOfferPrice}
                  onChange={(e) => setItemOfferPrice(e.target.value)}
                  className="h-9 pl-7 bg-white text-sm"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (outletLoading || loading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!currentOutlet) {
    return (
      <AppLayout>
        <div className="p-6 max-w-7xl mx-auto">
          <EmptyState
            icon={UtensilsCrossed}
            title="No Outlet Selected"
            description="Create an outlet first before managing your menu"
            actionLabel="Go to Outlets"
            onAction={() => window.location.href = "/outlets"}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-full overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl gradient-primary glow-primary">
              <UtensilsCrossed className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">Menu</h1>
              <p className="text-sm text-muted-foreground">Manage items, specials and offers</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <MenuImportDialog
              outletId={currentOutlet.id}
              categories={categories}
              onImportComplete={() => { fetchCategories(); fetchMenuItems(); }}
            />

            <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-10">
                  <Tag className="h-4 w-4 mr-2" />
                  Add Category
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-display">New Category</DialogTitle>
                  <DialogDescription>Create a category to organize menu items</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateCategory} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Category Name</Label>
                    <Input
                      placeholder="e.g., Starters, Main Course"
                      value={categoryName}
                      onChange={(e) => setCategoryName(e.target.value)}
                      className="h-11"
                    />
                  </div>
                  <Button type="submit" className="w-full h-11 gradient-primary" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Category"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={isItemDialogOpen} onOpenChange={(open) => { setIsItemDialogOpen(open); if (!open) resetItemForm(); }}>
              <DialogTrigger asChild>
                <Button className="gradient-primary glow-primary h-10">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-display">New Menu Item</DialogTitle>
                  <DialogDescription>Add a new item to your menu</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateItem} className="space-y-4 mt-4">
                  <ImageUploadSection />
                  <div className="space-y-2">
                    <Label>Item Name *</Label>
                    <Input
                      placeholder="e.g., Paneer Tikka"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      placeholder="Brief description"
                      value={itemDescription}
                      onChange={(e) => setItemDescription(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Price *</Label>
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={itemPrice}
                          onChange={(e) => setItemPrice(e.target.value)}
                          className="h-11 pl-9"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={itemCategory} onValueChange={setItemCategory}>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Percent className="h-3.5 w-3.5 text-muted-foreground" /> GST Category
                      <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Select value={itemGstCategory} onValueChange={setItemGstCategory}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="No GST / Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={GST_NONE}>No GST</SelectItem>
                        {GST_CATEGORIES.map(cat => {
                          const rate = currentOutlet?.gst_categories?.[cat.key] ?? cat.defaultRate;
                          return (
                            <SelectItem key={cat.key} value={cat.key}>
                              {cat.label} — {rate}%
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      {itemIsVeg ? <Leaf className="h-4 w-4 text-green-500" /> : <Flame className="h-4 w-4 text-red-500" />}
                      <span className="text-sm font-medium">{itemIsVeg ? "Vegetarian" : "Non-Vegetarian"}</span>
                    </div>
                    <Switch checked={itemIsVeg} onCheckedChange={setItemIsVeg} />
                  </div>
                  <SpecialsOfferSection />
                  <Button type="submit" className="w-full h-11 gradient-primary" disabled={isSubmitting || uploadingImage || fetchingImages}>
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Item"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 max-w-full overflow-x-auto pb-2">
          <div className="flex gap-2">
            <Button variant={vegFilter === null ? "secondary" : "outline"} size="sm" className="rounded-full"
              onClick={() => setVegFilter(null)}>All</Button>
            <Button variant={vegFilter === true ? "secondary" : "outline"} size="sm" className="rounded-full gap-1.5"
              onClick={() => setVegFilter(true)}>
              <Leaf className="h-3.5 w-3.5 text-green-500" /> Veg
            </Button>
            <Button variant={vegFilter === false ? "secondary" : "outline"} size="sm" className="rounded-full gap-1.5"
              onClick={() => setVegFilter(false)}>
              <Flame className="h-3.5 w-3.5 text-red-500" /> Non-Veg
            </Button>
          </div>

          {categories.length > 0 && (
            <>
              <div className="h-6 w-px bg-border" />
              <div className="flex flex-wrap gap-2">
                <Button variant={selectedCategory === null ? "secondary" : "outline"} size="sm" className="rounded-full"
                  onClick={() => setSelectedCategory(null)}>All Categories</Button>
                {categories.map((cat) => (
                  <Button key={cat.id} variant={selectedCategory === cat.id ? "secondary" : "outline"} size="sm"
                    className="rounded-full" onClick={() => setSelectedCategory(cat.id)}>
                    {cat.name}
                  </Button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Menu Items Grid */}
        {menuItems.length === 0 ? (
          <EmptyState
            icon={UtensilsCrossed}
            title="No Menu Items"
            description="Start by adding your first menu item"
            actionLabel="Add First Item"
            onAction={() => setIsItemDialogOpen(true)}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {menuItems
              .filter(item => selectedCategory === null || item.category_id === selectedCategory)
              .filter(item => vegFilter === null || item.is_veg === vegFilter)
              .map((item) => (
                <Card
                  key={item.id}
                  className="group hover:border-primary/50 transition-all duration-300 overflow-hidden cursor-pointer"
                  onClick={() => openEditDialog(item)}
                >
                  {/* Image */}
                  <div className="relative h-36 bg-muted/30 overflow-hidden">
                    {item.image_url ? (
                      <img src={getImageUrl(item.image_url)} alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
                        <Camera className="h-7 w-7 text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors" />
                        <span className="text-xs text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors">Add photo</span>
                      </div>
                    )}
                    {/* Special badge on image */}
                    {item.is_special && (
                      <span className="absolute top-2 left-2 flex items-center gap-1 bg-amber-400 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                        <Star className="h-2.5 w-2.5" /> {item.special_label}
                      </span>
                    )}
                    {/* Offer badge on image */}
                    {item.offer_label && (
                      <span className="absolute top-2 right-2 flex items-center gap-1 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                        {item.offer_label}
                      </span>
                    )}
                  </div>

                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center ${item.is_veg ? "border-green-500" : "border-red-500"}`}>
                          <div className={`w-2 h-2 rounded-full ${item.is_veg ? "bg-green-500" : "bg-red-500"}`} />
                        </div>
                        <CardTitle className="font-display text-base group-hover:text-primary transition-colors">
                          {item.name}
                        </CardTitle>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        item.is_available ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"
                      }`}>
                        {item.is_available ? "Available" : "Unavailable"}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {item.description && (
                      <CardDescription className="text-sm mb-3 line-clamp-2">{item.description}</CardDescription>
                    )}
                    <div className="flex items-center justify-between">
                      {item.offer_price ? (
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-bold text-green-600">₹{item.offer_price.toFixed(0)}</span>
                          <span className="text-sm text-muted-foreground line-through">₹{item.base_price.toFixed(0)}</span>
                        </div>
                      ) : (
                        <span className="text-lg font-bold text-primary">₹{item.base_price.toFixed(0)}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}

        {/* Edit Item Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => !open && closeEditDialog()}>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Edit Menu Item</DialogTitle>
              <DialogDescription>Update item details</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateItem} className="space-y-4 mt-4">
              <ImageUploadSection />
              <div className="space-y-2">
                <Label>Item Name *</Label>
                <Input
                  placeholder="e.g., Paneer Tikka"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Brief description"
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Price *</Label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={itemPrice}
                      onChange={(e) => setItemPrice(e.target.value)}
                      className="h-11 pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={itemCategory} onValueChange={setItemCategory}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Percent className="h-3.5 w-3.5 text-muted-foreground" /> GST Category
                  <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Select value={itemGstCategory} onValueChange={setItemGstCategory}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="No GST / Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={GST_NONE}>No GST</SelectItem>
                    {GST_CATEGORIES.map(cat => {
                      const rate = currentOutlet?.gst_categories?.[cat.key] ?? cat.defaultRate;
                      return (
                        <SelectItem key={cat.key} value={cat.key}>
                          {cat.label} — {rate}%
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  {itemIsVeg ? <Leaf className="h-4 w-4 text-green-500" /> : <Flame className="h-4 w-4 text-red-500" />}
                  <span className="text-sm font-medium">{itemIsVeg ? "Vegetarian" : "Non-Vegetarian"}</span>
                </div>
                <Switch checked={itemIsVeg} onCheckedChange={setItemIsVeg} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm font-medium">Available</span>
                <Switch checked={itemIsAvailable} onCheckedChange={setItemIsAvailable} />
              </div>
              <SpecialsOfferSection />
              <div className="flex gap-2">
                <Button type="button" variant="destructive" size="sm" onClick={handleDeleteItem} className="h-11">
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button type="submit" className="flex-1 h-11 gradient-primary" disabled={isSubmitting || uploadingImage || fetchingImages}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

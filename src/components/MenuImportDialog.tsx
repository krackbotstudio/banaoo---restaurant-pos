import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Camera, FileImage, Sparkles, Check } from "lucide-react";

interface ExtractedItem {
  name: string;
  description?: string;
  price: number;
  is_veg?: boolean | null;
  category?: string;
  selected?: boolean;
}

interface MenuImportDialogProps {
  outletId: string;
  categories: { id: string; name: string }[];
  onImportComplete: () => void;
}

export function MenuImportDialog({ outletId, categories, onImportComplete }: MenuImportDialogProps) {
  const { toast } = useToast();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ variant: "destructive", title: "Invalid file", description: "Please upload an image file" });
      return;
    }

    // Show preview
    setPreviewUrl(URL.createObjectURL(file));
    setExtractedItems([]);
    setIsProcessing(true);

    try {
      // Compress & convert to base64 (max 1024px, 80% JPEG — keeps payload under 1 MB)
      const { base64, mimeType: compressedMime } = await compressAndEncode(file);

      // Call Express API endpoint
      const API_URL = import.meta.env.VITE_API_URL ?? "";
      const response = await fetch(`${API_URL}/api/extract-menu`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: compressedMime })
      });

      const data = await response.json();

      if (!response.ok) {
        const detail = data.details ? `${data.error} — ${data.details}` : data.error;
        console.error('extract-menu error:', detail);
        throw new Error(detail || 'Failed to extract menu');
      }

      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        setExtractedItems(data.items.map((item: ExtractedItem) => ({ ...item, selected: true })));
        toast({ title: "Menu extracted!", description: `Found ${data.items.length} items` });
      } else {
        toast({ variant: "destructive", title: "No items found", description: "Could not extract menu items from the image" });
      }
    } catch (error: any) {
      console.error('Extraction failed:', error);
      // Reset preview so the upload UI shows again (not a blank dialog)
      setPreviewUrl(null);
      toast({ variant: "destructive", title: "Extraction failed", description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  // Resize to max 1024 px on longest side and re-encode as JPEG at 80%
  // This keeps the payload well under 1 MB regardless of camera resolution
  const compressAndEncode = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const MAX = 1024;
        let { width: w, height: h } = img;
        if (w > MAX || h > MAX) {
          if (w >= h) { h = Math.round((h * MAX) / w); w = MAX; }
          else        { w = Math.round((w * MAX) / h); h = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        resolve({ base64: dataUrl.split(",")[1], mimeType: "image/jpeg" });
      };
      img.onerror = reject;
      img.src = objectUrl;
    });
  };

  const toggleItem = (index: number) => {
    setExtractedItems(prev => 
      prev.map((item, i) => i === index ? { ...item, selected: !item.selected } : item)
    );
  };

  const toggleAll = (selected: boolean) => {
    setExtractedItems(prev => prev.map(item => ({ ...item, selected })));
  };

  const handleImport = async () => {
    const selectedItems = extractedItems.filter(item => item.selected);
    if (selectedItems.length === 0) {
      toast({ variant: "destructive", title: "No items selected", description: "Select at least one item to import" });
      return;
    }

    setIsImporting(true);

    try {
      // Create categories first if they don't exist
      const uniqueCategories = [...new Set(selectedItems.map(item => item.category).filter(Boolean))];
      const categoryMap: Record<string, string> = {};

      for (const catName of uniqueCategories) {
        if (!catName) continue;
        
        // Check if category exists
        const existingCat = categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
        if (existingCat) {
          categoryMap[catName] = existingCat.id;
        } else {
          // Create new category
          const { data: newCat, error } = await supabase
            .from('menu_categories')
            .insert({ name: catName, outlet_id: outletId })
            .select()
            .single();
          
          if (!error && newCat) {
            categoryMap[catName] = newCat.id;
          }
        }
      }

      // Insert menu items
      const itemsToInsert = selectedItems.map(item => ({
        name: item.name,
        description: item.description || null,
        base_price: item.price,
        is_veg: item.is_veg ?? true,
        category_id: item.category ? categoryMap[item.category] || null : null,
        outlet_id: outletId,
      }));

      const { error } = await supabase.from('menu_items').insert(itemsToInsert);

      if (error) throw error;

      toast({ title: "Import successful!", description: `Added ${selectedItems.length} items to your menu. Photos loading…` });
      setIsOpen(false);
      setExtractedItems([]);
      setPreviewUrl(null);
      onImportComplete();

      // Auto-assign images in background for all imported items
      // Sequential with a small gap to be gentle on the edge function
      const assignImages = async () => {
        for (const item of selectedItems) {
          try {
            const { data: imgData } = await supabase.functions.invoke('generate-menu-image', {
              body: { item_name: item.name },
            });
            const photo = imgData?.photos?.[0];
            if (photo) {
              await supabase
                .from('menu_items')
                .update({ image_url: photo.url })
                .eq('outlet_id', outletId)
                .eq('name', item.name)
                .is('image_url', null); // only update if still unset
            }
          } catch {
            // silent — image is optional
          }
          await new Promise(r => setTimeout(r, 300)); // 300ms gap between items
        }
        onImportComplete(); // final refresh once all images are in
      };
      assignImages(); // fire and forget
    } catch (error: any) {
      console.error('Import error:', error);
      toast({ variant: "destructive", title: "Import failed", description: error.message });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setExtractedItems([]);
      setPreviewUrl(null);
    }
    setIsOpen(open);
  };

  const selectedCount = extractedItems.filter(i => i.selected).length;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-10">
          <Sparkles className="h-4 w-4 mr-2" />
          AI Import
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Import Menu with AI
          </DialogTitle>
          <DialogDescription>
            Upload a photo of your physical menu and we'll extract all items automatically
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 mt-4">
          {/* Upload Area */}
          {!previewUrl && !isProcessing && (
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-8 text-center">
              {/* Camera input - uses capture to open camera directly */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />
              {/* Gallery input - no capture attribute opens file picker */}
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 rounded-full bg-primary/10">
                  <Camera className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Take a photo or upload menu image</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Supports JPG, PNG, HEIC
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" size="sm" onClick={() => cameraInputRef.current?.click()}>
                    <Camera className="h-4 w-4 mr-2" />
                    Camera
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => galleryInputRef.current?.click()}>
                    <FileImage className="h-4 w-4 mr-2" />
                    Gallery
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Processing State */}
          {isProcessing && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-medium">Analyzing menu...</p>
                <p className="text-sm text-muted-foreground">AI is extracting items from your menu</p>
              </div>
            </div>
          )}

          {/* Results */}
          {extractedItems.length > 0 && !isProcessing && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {previewUrl && (
                    <img 
                      src={previewUrl} 
                      alt="Menu preview" 
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                  )}
                  <div>
                    <p className="font-medium">{extractedItems.length} items found</p>
                    <p className="text-sm text-muted-foreground">{selectedCount} selected for import</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => toggleAll(true)}>
                    Select All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleAll(false)}>
                    Deselect All
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1 max-h-[40vh] border rounded-lg">
                <div className="p-2 space-y-2">
                  {extractedItems.map((item, index) => (
                    <Card 
                      key={index} 
                      className={`cursor-pointer transition-all ${item.selected ? 'border-primary bg-primary/5' : 'opacity-60'}`}
                      onClick={() => toggleItem(index)}
                    >
                      <CardContent className="p-3 flex items-start gap-3">
                        <Checkbox 
                          checked={item.selected} 
                          className="mt-1"
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={() => toggleItem(index)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-sm border-2 flex items-center justify-center ${
                              item.is_veg === true ? "border-green-500" : 
                              item.is_veg === false ? "border-red-500" : "border-gray-400"
                            }`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${
                                item.is_veg === true ? "bg-green-500" : 
                                item.is_veg === false ? "bg-red-500" : "bg-gray-400"
                              }`} />
                            </div>
                            <span className="font-medium truncate">{item.name}</span>
                            {item.category && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                {item.category}
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-sm text-muted-foreground truncate mt-0.5">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <span className="font-bold text-primary whitespace-nowrap">₹{item.price}</span>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => galleryInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Try Another Photo
                </Button>
                <Button
                  className="flex-1 gradient-primary"
                  onClick={handleImport}
                  disabled={selectedCount === 0 || isImporting}
                >
                  {isImporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Import {selectedCount} Items
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

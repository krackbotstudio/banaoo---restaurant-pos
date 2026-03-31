import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Upload, Camera, Loader2, ImagePlus, Check, X, RefreshCw } from "lucide-react";
import { MenuCategory, MenuItem, generateId } from "@/lib/menu-encoder";

interface ExtractedItem {
  name: string;
  description?: string;
  price: number;
  is_veg?: boolean | null;
  category?: string;
  selected?: boolean;
}

interface MenuImportDialogProps {
  onImport: (categories: MenuCategory[]) => void;
}

export function MenuImportDialog({ onImport }: MenuImportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload an image (JPG, PNG, WebP) or PDF file");
      return;
    }

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }

    setIsProcessing(true);
    setExtractedItems([]);

    try {
      // Convert file to base64
      const base64 = await fileToBase64(file);
      
      // Call Express API endpoint
      const API_URL = import.meta.env.VITE_API_URL ?? "";
      const response = await fetch(`${API_URL}/api/extract-menu`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to extract menu');
      }

      if (data.items && data.items.length > 0) {
        const items = data.items.map((item: ExtractedItem) => ({
          ...item,
          selected: true,
        }));
        setExtractedItems(items);
        toast.success(`Found ${items.length} menu items!`);
      } else {
        toast.info("No menu items could be extracted. Try a clearer image.");
      }
    } catch (error) {
      console.error('Error extracting menu:', error);
      toast.error("Failed to extract menu items. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const toggleItem = (index: number) => {
    setExtractedItems(items =>
      items.map((item, i) =>
        i === index ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const toggleAll = (selected: boolean) => {
    setExtractedItems(items =>
      items.map(item => ({ ...item, selected }))
    );
  };

  const handleImport = () => {
    const selectedItems = extractedItems.filter(item => item.selected);
    if (selectedItems.length === 0) {
      toast.error("Please select at least one item to import");
      return;
    }

    // Group items by category
    const categoryMap = new Map<string, MenuItem[]>();
    
    selectedItems.forEach(item => {
      const categoryName = item.category || 'Uncategorized';
      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, []);
      }
      categoryMap.get(categoryName)!.push({
        id: generateId(),
        name: item.name,
        price: item.price,
        description: item.description,
        is_veg: item.is_veg,
      });
    });

    // Convert to categories array
    const categories: MenuCategory[] = Array.from(categoryMap.entries()).map(
      ([name, items]) => ({
        id: generateId(),
        name,
        items,
      })
    );

    onImport(categories);
    toast.success(`Imported ${selectedItems.length} items in ${categories.length} categories`);
    handleClose();
  };

  const handleClose = () => {
    setIsOpen(false);
    setExtractedItems([]);
    setPreviewUrl(null);
    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const selectedCount = extractedItems.filter(i => i.selected).length;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <ImagePlus className="h-4 w-4" />
          Import from Photo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Menu from Photo</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Upload Area */}
          {!isProcessing && extractedItems.length === 0 && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-4">
                  Upload a photo of your menu and our AI will extract all items automatically
                </p>
                <div className="flex gap-2 justify-center">
                  <Button
                    variant="outline"
                    onClick={() => cameraInputRef.current?.click()}
                    className="gap-2"
                  >
                    <Camera className="h-4 w-4" />
                    Take Photo
                  </Button>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Upload
                  </Button>
                </div>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {/* Processing State */}
          {isProcessing && (
            <div className="text-center py-12">
              <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Analyzing your menu...</p>
              <p className="text-sm text-muted-foreground mt-2">
                This may take a few seconds
              </p>
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Menu preview"
                  className="mt-4 max-h-32 mx-auto rounded-lg opacity-50"
                />
              )}
            </div>
          )}

          {/* Results */}
          {!isProcessing && extractedItems.length > 0 && (
            <div className="space-y-4">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Menu preview"
                  className="max-h-24 mx-auto rounded-lg"
                />
              )}
              
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Found {extractedItems.length} items • {selectedCount} selected
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleAll(true)}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleAll(false)}
                  >
                    Deselect All
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-2">
                  {extractedItems.map((item, index) => (
                    <div
                      key={index}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                        item.selected
                          ? 'bg-primary/5 border-primary/20'
                          : 'bg-muted/30 border-transparent'
                      }`}
                      onClick={() => toggleItem(index)}
                    >
                      <Checkbox
                        checked={item.selected}
                        onCheckedChange={() => toggleItem(index)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {item.is_veg !== null && item.is_veg !== undefined && (
                            <span
                              className={`w-3 h-3 rounded-sm border-2 flex-shrink-0 ${
                                item.is_veg
                                  ? 'border-green-600 bg-green-600'
                                  : 'border-red-600 bg-red-600'
                              }`}
                            />
                          )}
                          <span className="font-medium truncate">{item.name}</span>
                          <span className="text-muted-foreground ml-auto flex-shrink-0">
                            ₹{item.price}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-sm text-muted-foreground truncate mt-1">
                            {item.description}
                          </p>
                        )}
                        {item.category && (
                          <span className="inline-block text-xs bg-muted px-2 py-0.5 rounded mt-1">
                            {item.category}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setExtractedItems([]);
                    setPreviewUrl(null);
                  }}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Another
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={selectedCount === 0}
                  className="flex-1 gap-2"
                >
                  <Check className="h-4 w-4" />
                  Import {selectedCount} Items
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

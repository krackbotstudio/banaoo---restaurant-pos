import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ImagePlus, Trash2, X } from "lucide-react";
import { MenuItem, compressImage } from "@/lib/menu-encoder";

interface MenuItemFormProps {
  item: MenuItem;
  currency: string;
  onChange: (item: MenuItem) => void;
  onDelete: () => void;
}

export function MenuItemForm({ item, currency, onChange, onDelete }: MenuItemFormProps) {
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const compressed = await compressImage(file, 200, 0.6);
      onChange({ ...item, photo: compressed });
    } catch (error) {
      console.error('Failed to upload photo:', error);
    }
  };

  const cycleVegStatus = () => {
    // Cycle through: null -> true (veg) -> false (non-veg) -> null
    if (item.is_veg === null || item.is_veg === undefined) {
      onChange({ ...item, is_veg: true });
    } else if (item.is_veg === true) {
      onChange({ ...item, is_veg: false });
    } else {
      onChange({ ...item, is_veg: null });
    }
  };

  const getVegIndicator = () => {
    if (item.is_veg === true) {
      return (
        <div className="flex items-center gap-1.5 text-green-600">
          <span className="w-4 h-4 rounded border-2 border-green-600 flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-green-600" />
          </span>
          <span className="text-xs font-medium">Veg</span>
        </div>
      );
    }
    if (item.is_veg === false) {
      return (
        <div className="flex items-center gap-1.5 text-red-600">
          <span className="w-4 h-4 rounded border-2 border-red-600 flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-red-600" />
          </span>
          <span className="text-xs font-medium">Non-Veg</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span className="w-4 h-4 rounded border-2 border-muted-foreground/50 flex items-center justify-center">
          <span className="w-2 h-2 rounded-full bg-muted-foreground/50" />
        </span>
        <span className="text-xs">Not set</span>
      </div>
    );
  };

  return (
    <div className="border rounded-lg p-3 space-y-3 bg-background">
      <div className="flex gap-3">
        {/* Photo */}
        <div className="flex-shrink-0">
          {item.photo ? (
            <div className="relative">
              <img 
                src={item.photo} 
                alt={item.name} 
                className="h-20 w-20 object-cover rounded-md border"
              />
              <button
                onClick={() => onChange({ ...item, photo: undefined })}
                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
                id={`photo-${item.id}`}
              />
              <button
                onClick={() => document.getElementById(`photo-${item.id}`)?.click()}
                className="h-20 w-20 border-2 border-dashed rounded-md flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <ImagePlus className="h-5 w-5" />
                <span className="text-xs mt-1">Photo</span>
              </button>
            </div>
          )}
        </div>

        {/* Fields */}
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="Item name"
              value={item.name}
              onChange={(e) => onChange({ ...item, name: e.target.value })}
              className="flex-1"
            />
            <div className="relative w-28">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {currency}
              </span>
              <Input
                type="number"
                placeholder="0"
                value={item.price || ""}
                onChange={(e) => onChange({ ...item, price: parseFloat(e.target.value) || 0 })}
                className="pl-7"
                min={0}
                step={0.01}
              />
            </div>
          </div>
          
          {/* Veg/Non-Veg Toggle */}
          <button
            type="button"
            onClick={cycleVegStatus}
            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted transition-colors"
            title="Click to change: Not set → Veg → Non-Veg → Not set"
          >
            {getVegIndicator()}
          </button>
          
          <Textarea
            placeholder="Description (optional)"
            value={item.description || ""}
            onChange={(e) => onChange({ ...item, description: e.target.value })}
            rows={2}
            className="resize-none text-sm"
          />
        </div>

        {/* Delete */}
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onDelete}
          className="text-destructive hover:text-destructive flex-shrink-0 h-8 w-8 p-0"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

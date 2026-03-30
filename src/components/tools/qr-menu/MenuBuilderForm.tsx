import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Upload, X } from "lucide-react";
import { MenuData, MenuCategory, compressImage, generateId } from "@/lib/menu-encoder";
import { CategorySection } from "./CategorySection";
import { MenuImportDialog } from "./MenuImportDialog";
import { useAuth } from "@/lib/auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MenuBuilderFormProps {
  menuData: MenuData;
  onChange: (data: MenuData) => void;
}

const currencies = [
  { value: "₹", label: "₹ INR" },
  { value: "$", label: "$ USD" },
  { value: "€", label: "€ EUR" },
  { value: "£", label: "£ GBP" },
  { value: "¥", label: "¥ JPY" },
];

export function MenuBuilderForm({ menuData, onChange }: MenuBuilderFormProps) {
  const { getImageUrl } = useAuth();
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const compressed = await compressImage(file, 150, 0.8);
      onChange({ ...menuData, logo: compressed });
    } catch (error) {
      console.error('Failed to upload logo:', error);
    }
  };

  const addCategory = () => {
    const newCategory: MenuCategory = {
      id: generateId(),
      name: "",
      items: [],
    };
    onChange({ ...menuData, categories: [...menuData.categories, newCategory] });
  };

  const updateCategory = (index: number, category: MenuCategory) => {
    const newCategories = [...menuData.categories];
    newCategories[index] = category;
    onChange({ ...menuData, categories: newCategories });
  };

  const deleteCategory = (index: number) => {
    const newCategories = menuData.categories.filter((_, i) => i !== index);
    onChange({ ...menuData, categories: newCategories });
  };

  const handleImport = (categories: MenuCategory[]) => {
    // Merge imported categories with existing ones
    onChange({ ...menuData, categories: [...menuData.categories, ...categories] });
  };

  return (
    <div className="space-y-6">
      {/* Restaurant Info */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Restaurant Details</h3>
        
        <div className="space-y-2">
          <Label htmlFor="restaurantName">Restaurant Name *</Label>
          <Input
            id="restaurantName"
            placeholder="Enter restaurant name"
            value={menuData.restaurantName}
            onChange={(e) => onChange({ ...menuData, restaurantName: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tagline">Tagline (optional)</Label>
          <Input
            id="tagline"
            placeholder="e.g., Authentic Italian Cuisine"
            value={menuData.tagline || ""}
            onChange={(e) => onChange({ ...menuData, tagline: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>Currency</Label>
          <Select
            value={menuData.currency}
            onValueChange={(value) => onChange({ ...menuData, currency: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currencies.map((currency) => (
                <SelectItem key={currency.value} value={currency.value}>
                  {currency.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Logo (optional)</Label>
          {menuData.logo ? (
            <div className="flex items-center gap-3">
              <img 
                src={getImageUrl(menuData.logo)} 
                alt="Logo" 
                className="h-16 w-16 object-cover rounded-lg border"
              />
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onChange({ ...menuData, logo: undefined })}
              >
                <X className="h-4 w-4 mr-1" />
                Remove
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
                id="logo-upload"
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => document.getElementById('logo-upload')?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Logo
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-semibold text-lg">Menu Categories</h3>
          <div className="flex gap-2">
            <MenuImportDialog onImport={handleImport} />
            <Button onClick={addCategory} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Category
            </Button>
          </div>
        </div>

        {menuData.categories.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground">No categories yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Click "Add Category" or use "Import from Photo" to get started
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {menuData.categories.map((category, index) => (
              <CategorySection
                key={category.id}
                category={category}
                currency={menuData.currency}
                onChange={(updated) => updateCategory(index, updated)}
                onDelete={() => deleteCategory(index)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

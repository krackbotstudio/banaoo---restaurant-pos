import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { MenuCategory, MenuItem, generateId } from "@/lib/menu-encoder";
import { MenuItemForm } from "./MenuItemForm";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface CategorySectionProps {
  category: MenuCategory;
  currency: string;
  onChange: (category: MenuCategory) => void;
  onDelete: () => void;
}

export function CategorySection({ category, currency, onChange, onDelete }: CategorySectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  const addItem = () => {
    const newItem: MenuItem = {
      id: generateId(),
      name: "",
      price: 0,
    };
    onChange({ ...category, items: [...category.items, newItem] });
  };

  const updateItem = (index: number, item: MenuItem) => {
    const newItems = [...category.items];
    newItems[index] = item;
    onChange({ ...category, items: newItems });
  };

  const deleteItem = (index: number) => {
    const newItems = category.items.filter((_, i) => i !== index);
    onChange({ ...category, items: newItems });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-lg">
      <div className="flex items-center gap-2 p-3 bg-muted/50">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="p-1 h-auto">
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        
        <Input
          placeholder="Category name (e.g., Starters)"
          value={category.name}
          onChange={(e) => onChange({ ...category, name: e.target.value })}
          className="flex-1"
        />
        
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {category.items.length} items
        </span>
        
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <CollapsibleContent>
        <div className="p-3 space-y-3 border-t">
          {category.items.map((item, index) => (
            <MenuItemForm
              key={item.id}
              item={item}
              currency={currency}
              onChange={(updated) => updateItem(index, updated)}
              onDelete={() => deleteItem(index)}
            />
          ))}

          <Button variant="outline" onClick={addItem} className="w-full" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add Item
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

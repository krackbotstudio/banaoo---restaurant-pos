import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface Category {
  id: string;
  name: string;
}

interface CategoryTabsProps {
  categories: Category[];
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
}

export function CategoryTabs({
  categories,
  selectedCategory,
  onSelectCategory,
}: CategoryTabsProps) {
  return (
    <div className="sticky top-[145px] z-30 bg-background/95 backdrop-blur-sm border-b border-border/50 max-w-full overflow-hidden">
      <ScrollArea className="w-full">
        <div className="flex gap-2 p-4">
          <button
            type="button"
            onClick={() => onSelectCategory("all")}
            className={cn(
              "shrink-0 px-5 py-2.5 rounded-full font-medium text-sm transition-all",
              "border-2 whitespace-nowrap",
              selectedCategory === "all"
                ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25"
                : "bg-card border-border/50 text-muted-foreground hover:border-primary/50 hover:text-foreground"
            )}
          >
            All Items
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => onSelectCategory(category.id)}
              className={cn(
                "shrink-0 px-5 py-2.5 rounded-full font-medium text-sm transition-all",
                "border-2 whitespace-nowrap",
                selectedCategory === category.id
                  ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25"
                  : "bg-card border-border/50 text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}
            >
              {category.name}
            </button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="invisible" />
      </ScrollArea>
    </div>
  );
}

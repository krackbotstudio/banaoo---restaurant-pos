import { useParams, Link } from "react-router-dom";
import { decodeMenuData, MenuData, MenuCategory, MenuItem } from "@/lib/menu-encoder";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

function VegIndicator({ isVeg }: { isVeg: boolean | null | undefined }) {
  if (isVeg === null || isVeg === undefined) return null;
  
  return (
    <span
      className={cn(
        "w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0",
        isVeg ? "border-green-600" : "border-red-600"
      )}
    >
      <span
        className={cn(
          "w-2 h-2 rounded-full",
          isVeg ? "bg-green-600" : "bg-red-600"
        )}
      />
    </span>
  );
}

function MenuItemCard({ item, currency }: { item: MenuItem; currency: string }) {
  const { getImageUrl } = useAuth();
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      {item.photo && (
        <div className="aspect-video w-full overflow-hidden">
          <img
            src={getImageUrl(item.photo)}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start gap-2">
          <VegIndicator isVeg={item.is_veg} />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 leading-tight">{item.name}</h3>
            {item.description && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{item.description}</p>
            )}
          </div>
          <span className="font-bold text-primary whitespace-nowrap">
            {currency}{item.price}
          </span>
        </div>
      </div>
    </div>
  );
}

function CategorySectionView({ 
  category, 
  currency, 
  id 
}: { 
  category: MenuCategory; 
  currency: string;
  id: string;
}) {
  return (
    <section id={id} className="scroll-mt-28">
      <h2 className="text-xl font-bold text-gray-900 mb-4 px-1">{category.name}</h2>
      <div className="grid gap-3">
        {category.items.map((item) => (
          <MenuItemCard key={item.id} item={item} currency={currency} />
        ))}
      </div>
    </section>
  );
}

function CategoryTabs({ 
  categories, 
  activeCategory, 
  onSelect 
}: { 
  categories: MenuCategory[];
  activeCategory: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div 
      className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 px-1"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => onSelect(category.id)}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
            activeCategory === category.id
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
        >
          {category.name || "Unnamed"}
        </button>
      ))}
    </div>
  );
}

export default function MenuViewer() {
  const { menuData: encodedData } = useParams<{ menuData: string }>();
  const [activeCategory, setActiveCategory] = useState<string>("");
  const { getImageUrl } = useAuth();
  const [menuData, setMenuData] = useState<MenuData | null>(null);
  
  useEffect(() => {
    if (encodedData) {
      const decoded = decodeMenuData(encodedData);
      setMenuData(decoded);
      if (decoded?.categories.length) {
        setActiveCategory(decoded.categories[0].id);
      }
    }
  }, [encodedData]);

  if (!menuData || !menuData.restaurantName) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Menu Not Found</h1>
          <p className="text-gray-500 mb-4">This menu link may be invalid or expired.</p>
          <Link
            to="/tools/qr-menu-builder"
            className="text-primary font-medium hover:underline"
          >
            Create your own menu →
          </Link>
        </div>
      </div>
    );
  }

  const handleCategorySelect = (categoryId: string) => {
    setActiveCategory(categoryId);
    const element = document.getElementById(`category-${categoryId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const totalItems = menuData.categories.reduce((sum, cat) => sum + cat.items.length, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            {menuData.logo && (
              <img
                src={getImageUrl(menuData.logo)}
                alt={menuData.restaurantName}
                className="w-12 h-12 rounded-xl object-cover border border-gray-100 shadow-sm"
              />
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900 truncate">
                {menuData.restaurantName}
              </h1>
              {menuData.tagline && (
                <p className="text-sm text-gray-500 truncate">{menuData.tagline}</p>
              )}
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        {menuData.categories.length > 0 && (
          <div className="max-w-lg mx-auto px-4 pb-3">
            <CategoryTabs
              categories={menuData.categories}
              activeCategory={activeCategory}
              onSelect={handleCategorySelect}
            />
          </div>
        )}
      </header>

      {/* Menu Content */}
      <main className="max-w-lg mx-auto px-4 py-6 space-y-8">
        {menuData.categories.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No menu items available</p>
          </div>
        ) : (
          menuData.categories.map((category) => (
            <CategorySectionView
              key={category.id}
              id={`category-${category.id}`}
              category={category}
              currency={menuData.currency}
            />
          ))
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white mt-8">
        <div className="max-w-lg mx-auto px-4 py-6 text-center">
          <p className="text-xs text-gray-400 mb-2">
            {menuData.categories.length} categories • {totalItems} items
          </p>
          <a
            href="https://flazee.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary transition-colors"
          >
            Powered by <span className="font-semibold">flazee.com</span>
          </a>
        </div>
      </footer>
    </div>
  );
}

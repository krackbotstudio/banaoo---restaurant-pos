import { MenuData } from "@/lib/menu-encoder";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/lib/auth";

interface MenuPreviewProps {
  menuData: MenuData;
}

export function MenuPreview({ menuData }: MenuPreviewProps) {
  const { getImageUrl } = useAuth();
  const hasContent = menuData.restaurantName || menuData.categories.some(c => c.items.length > 0);

  return (
    <div className="bg-muted/30 rounded-xl p-4 flex items-center justify-center">
      {/* Phone Frame */}
      <div className="w-[280px] h-[560px] bg-background rounded-[2rem] shadow-xl border-4 border-foreground/10 overflow-hidden flex flex-col">
        {/* Phone Notch */}
        <div className="h-6 bg-foreground/5 flex items-center justify-center">
          <div className="w-20 h-4 bg-foreground/10 rounded-full" />
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {!hasContent ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-20">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <span className="text-2xl">📱</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Start building your menu to see a preview
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Header */}
                <div className="text-center space-y-2">
                  {menuData.logo && (
                    <img 
                      src={getImageUrl(menuData.logo)} 
                      alt="Logo" 
                      className="w-16 h-16 object-cover rounded-full mx-auto border"
                    />
                  )}
                  <h1 className="font-bold text-lg">
                    {menuData.restaurantName || "Restaurant Name"}
                  </h1>
                  {menuData.tagline && (
                    <p className="text-xs text-muted-foreground">{menuData.tagline}</p>
                  )}
                </div>

                {/* Categories */}
                {menuData.categories.map((category) => (
                  category.name || category.items.length > 0 ? (
                    <div key={category.id} className="space-y-2">
                      <h2 className="font-semibold text-sm border-b pb-1">
                        {category.name || "Untitled Category"}
                      </h2>
                      
                      {category.items.map((item) => (
                        <div key={item.id} className="flex gap-2 text-xs">
                          {item.photo && (
                            <img 
                              src={getImageUrl(item.photo)} 
                              alt={item.name}
                              className="w-12 h-12 object-cover rounded-md flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between gap-1">
                              <span className="font-medium truncate">
                                {item.name || "Item name"}
                              </span>
                              <span className="text-primary font-semibold whitespace-nowrap">
                                {menuData.currency}{item.price.toFixed(2)}
                              </span>
                            </div>
                            {item.description && (
                              <p className="text-muted-foreground text-[10px] line-clamp-2">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Phone Home Bar */}
        <div className="h-5 flex items-center justify-center">
          <div className="w-24 h-1 bg-foreground/20 rounded-full" />
        </div>
      </div>
    </div>
  );
}

import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Plus, ChefHat, ClipboardList, MessageCircle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { TrialBanner } from "@/components/TrialBanner";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;
  const mobileHeaderTitle = location.pathname === "/orders/new" ? "New Order" : "";

  return (
    <>
      {/* Global Trial Banner - fixed at top, above everything */}
      <TrialBanner />
      
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <SidebarInset className="flex-1 min-w-0 flex flex-col overflow-x-hidden">
            <header className="h-14 border-b border-border flex items-center justify-between px-3 md:px-6 bg-background/80 backdrop-blur-sm sticky top-0 z-10 w-full">
              <div className="flex items-center">
                <SidebarTrigger className="md:hidden h-8 w-8" />
              </div>

              {mobileHeaderTitle && (
                <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 md:hidden">
                  <h1 className="max-w-[32vw] truncate text-xs font-semibold text-foreground">
                    {mobileHeaderTitle}
                  </h1>
                </div>
              )}
              
              {/* Always visible quick navigation */}
              <div className="flex items-center gap-1 md:gap-2">
                <NotificationCenter />
                <Button
                  type="button"
                  size="icon"
                  variant="default"
                  className="h-8 w-8 lg:hidden rounded-full gradient-warm text-white border-0 hover:opacity-90"
                  onClick={() => window.dispatchEvent(new CustomEvent("support-chat-toggle"))}
                  aria-label="Open support chat"
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>
                
                <Button 
                  asChild 
                  size="sm" 
                  variant={isActive("/orders/new") ? "default" : "outline"}
                  className={isActive("/orders/new") 
                    ? "hidden lg:inline-flex h-9 gradient-warm text-white border-0" 
                    : "hidden lg:inline-flex h-9 border-border hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-colors"
                  }
                >
                  <Link to="/orders/new">
                    <Plus className="h-4 w-4 mr-1.5" />
                    New Order
                  </Link>
                </Button>
                <Button 
                  asChild 
                  size="sm" 
                  variant={isActive("/orders") ? "secondary" : "outline"}
                  className="hidden lg:inline-flex h-9 border-border hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-colors"
                >
                  <Link to="/orders">
                    <ClipboardList className="h-4 w-4 mr-1.5" />
                    Orders
                  </Link>
                </Button>
                <Button 
                  asChild 
                  size="sm" 
                  variant={isActive("/kitchen") ? "secondary" : "outline"}
                  className="hidden lg:inline-flex h-9 border-border hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-colors"
                >
                  <Link to="/kitchen">
                    <ChefHat className="h-4 w-4 mr-1.5" />
                    Kitchen
                  </Link>
                </Button>
              </div>
            </header>

            <main className="flex-1 overflow-y-auto overflow-x-hidden pb-28 lg:pb-0 w-full min-w-0">
              {children}
            </main>
          </SidebarInset>
        </div>

        {/* Mobile + tablet bottom navigation */}
        <nav className="fixed bottom-0 left-0 right-0 z-[70] border-t border-border bg-background/95 shadow-[0_-6px_20px_rgba(0,0,0,0.08)] backdrop-blur-sm lg:hidden">
          <div className="grid grid-cols-3 items-center px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <Link
              to="/orders"
              className={`flex flex-col items-center justify-center gap-1 rounded-lg py-2 text-xs transition-colors ${
                isActive("/orders")
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ClipboardList className="h-5 w-5" />
              <span>Orders</span>
            </Link>

            <div className="flex justify-center">
              <Button
                asChild
                size="icon"
                className="h-12 w-12 rounded-full gradient-warm text-white shadow-lg"
              >
                <Link to="/orders/new" aria-label="New Order">
                  <Plus className="h-5 w-5" />
                </Link>
              </Button>
            </div>

            <Link
              to="/kitchen"
              className={`flex flex-col items-center justify-center gap-1 rounded-lg py-2 text-xs transition-colors ${
                isActive("/kitchen")
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ChefHat className="h-5 w-5" />
              <span>Kitchen</span>
            </Link>
          </div>
        </nav>
      </SidebarProvider>
    </>
  );
}

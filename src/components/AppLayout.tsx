import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Plus, ChefHat, ClipboardList } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { TrialBanner } from "@/components/TrialBanner";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* Global Trial Banner - fixed at top, above everything */}
      <TrialBanner />
      
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <SidebarInset className="flex-1 flex flex-col">
            <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
              <div />
              
              {/* Always visible quick navigation */}
              <div className="flex items-center gap-2">
                <NotificationCenter />
                
                <Button 
                  asChild 
                  size="sm" 
                  variant={isActive("/orders/new") ? "default" : "outline"}
                  className={isActive("/orders/new") 
                    ? "h-9 gradient-warm text-white border-0" 
                    : "h-9 border-border hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-colors"
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
                  className="h-9 border-border hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-colors"
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
                  className="h-9 border-border hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-colors"
                >
                  <Link to="/kitchen">
                    <ChefHat className="h-4 w-4 mr-1.5" />
                    Kitchen
                  </Link>
                </Button>
              </div>
            </header>

            <main className="flex-1 overflow-auto overflow-x-clip">
              {children}
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </>
  );
}

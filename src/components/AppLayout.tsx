import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Plus, ChefHat, ClipboardList, MessageCircle, LogOut, UserCog, LayoutDashboard, UtensilsCrossed } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { TrialBanner } from "@/components/TrialBanner";
import { useAuth } from "@/lib/auth";
import { useStaffPermissions } from "@/lib/use-staff-permissions";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  const { permissions, loading: permissionsLoading } = useStaffPermissions();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(`${path}/`);
  const mobileHeaderTitle = location.pathname === "/orders/new" ? "New Order" : "";

  const isStaff = profile && profile.role !== "owner";

  // Returns true if the current user can access a given page key.
  // Owners always can; staff must wait for permissions to load then check.
  const canAccess = (key: string): boolean => {
    if (!isStaff) return true;
    if (permissionsLoading) return false;
    if (permissions === null) return true;
    return permissions.includes(key);
  };

  const handleStaffSignOut = async () => {
    await signOut();
    navigate("/staff-login");
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Global Trial Banner - sits at top, takes natural height */}
      <TrialBanner />

      <SidebarProvider>
        {/* Remaining height after TrialBanner, flex-row: sidebar + content */}
        <div className="flex flex-1 w-full min-h-0 overflow-hidden">
          <AppSidebar />
          <SidebarInset className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {/* Header — always visible, stays in place via flex layout (no sticky needed) */}
            <header className="h-14 shrink-0 border-b border-border flex items-center justify-between px-3 md:px-6 bg-background/80 backdrop-blur-sm z-10 w-full">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="md:hidden h-8 w-8" />
                {isStaff && (
                  <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1">
                    <UserCog className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium text-foreground truncate max-w-[90px]">
                      {profile.full_name?.split(" ")[0] ?? profile.role}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize hidden sm:inline">
                      · {profile.role}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 ml-0.5"
                      onClick={handleStaffSignOut}
                      title="Sign out"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                    </Button>
                    <Link
                      to="/auth"
                      className="text-xs text-muted-foreground hover:text-primary transition-colors whitespace-nowrap hidden sm:inline"
                    >
                      Owner →
                    </Link>
                  </div>
                )}
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

                {canAccess("orders") && (
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
                )}
                {canAccess("orders") && (
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
                )}
                {canAccess("kitchen") && (
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
                )}
              </div>
            </header>

            {/* Scrollable page content — only this area scrolls */}
            <main className="flex-1 overflow-y-auto overflow-x-hidden pb-32 lg:pb-0 w-full min-w-0">
              {children}
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>

      {(canAccess("dashboard") || canAccess("menu") || canAccess("orders") || canAccess("kitchen")) && (
        <nav className="fixed bottom-0 left-0 right-0 z-[70] border-t border-border bg-background/95 shadow-[0_-6px_20px_rgba(0,0,0,0.08)] backdrop-blur-sm lg:hidden">
          <div className="flex w-full min-w-0 items-end px-1 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-2">
            {canAccess("dashboard") && (
              <div className="flex min-h-[52px] min-w-0 flex-1 basis-0 flex-col items-center justify-end">
                <Link
                  to="/dashboard"
                  className={`mx-auto flex w-full max-w-[72px] flex-col items-center justify-end gap-1 rounded-lg px-1 py-1.5 text-[11px] font-medium leading-tight transition-colors ${
                    isActive("/dashboard") ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <LayoutDashboard className="h-5 w-5 shrink-0" />
                  <span className="max-w-full truncate text-center">Home</span>
                </Link>
              </div>
            )}
            {canAccess("menu") && (
              <div className="flex min-h-[52px] min-w-0 flex-1 basis-0 flex-col items-center justify-end">
                <Link
                  to="/menu"
                  className={`mx-auto flex w-full max-w-[72px] flex-col items-center justify-end gap-1 rounded-lg px-1 py-1.5 text-[11px] font-medium leading-tight transition-colors ${
                    isActive("/menu") ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <UtensilsCrossed className="h-5 w-5 shrink-0" />
                  <span className="max-w-full truncate text-center">Menu</span>
                </Link>
              </div>
            )}
            {canAccess("orders") && (
              <div className="flex min-h-[52px] min-w-0 flex-1 basis-0 flex-col items-center justify-end">
                <div className="mx-auto flex w-full max-w-[72px] justify-center">
                  <Button
                    asChild
                    size="icon"
                    className="h-12 w-12 shrink-0 rounded-full gradient-warm text-white shadow-lg"
                  >
                    <Link to="/orders/new" aria-label="New Order">
                      <Plus className="h-5 w-5" />
                    </Link>
                  </Button>
                </div>
              </div>
            )}
            {canAccess("orders") && (
              <div className="flex min-h-[52px] min-w-0 flex-1 basis-0 flex-col items-center justify-end">
                <Link
                  to="/orders"
                  className={`mx-auto flex w-full max-w-[72px] flex-col items-center justify-end gap-1 rounded-lg px-1 py-1.5 text-[11px] font-medium leading-tight transition-colors ${
                    isActive("/orders") ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ClipboardList className="h-5 w-5 shrink-0" />
                  <span className="max-w-full truncate text-center">Orders</span>
                </Link>
              </div>
            )}
            {canAccess("kitchen") && (
              <div className="flex min-h-[52px] min-w-0 flex-1 basis-0 flex-col items-center justify-end">
                <Link
                  to="/kitchen"
                  className={`mx-auto flex w-full max-w-[72px] flex-col items-center justify-end gap-1 rounded-lg px-1 py-1.5 text-[11px] font-medium leading-tight transition-colors ${
                    isActive("/kitchen") ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ChefHat className="h-5 w-5 shrink-0" />
                  <span className="max-w-full truncate text-center">Kitchen</span>
                </Link>
              </div>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}

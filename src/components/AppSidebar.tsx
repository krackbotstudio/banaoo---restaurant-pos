import {
  ChefHat,
  UtensilsCrossed,
  ShoppingCart,
  LayoutDashboard,
  Users,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  Building2,
  Settings,
  Link2,
  History,
  BarChart2,
  UserCog,
  Boxes,
} from "lucide-react";
import { useFeatureGating } from "@/hooks/use-feature-gating";
import type { FeatureKey } from "@/hooks/use-feature-gating";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/lib/auth";
import { useOutlet } from "@/lib/outlet-context";
import { useStaffPermissions } from "@/lib/use-staff-permissions";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const mainNavItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, key: "dashboard" },
  { title: "Menu",      url: "/menu",      icon: UtensilsCrossed, key: "menu"      },
];

const operationsItems: {
  title: string;
  url: string;
  icon: typeof ShoppingCart;
  key: string;
  feature?: FeatureKey;
}[] = [
  { title: "Orders",        url: "/orders",        icon: ShoppingCart, key: "orders"        },
  { title: "Order History", url: "/order-history", icon: History,      key: "order-history" },
  { title: "Customers",     url: "/customers",     icon: Users,        key: "customers"     },
  { title: "Analytics",     url: "/analytics",     icon: BarChart2,    key: "analytics"     },
  { title: "Inventory",     url: "/inventory",     icon: Boxes,        key: "inventory", feature: "inventoryManagement" },
  { title: "Kitchen",       url: "/kitchen",       icon: ChefHat,      key: "kitchen"       },
  { title: "Staff",         url: "/staff",         icon: UserCog,      key: "staff"         },
  { title: "Integrations",  url: "/integrations",  icon: Link2,        key: "integrations"  },
  { title: "Settings",      url: "/settings",      icon: Settings,     key: "settings"      },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const { profile, signOut, getImageUrl } = useAuth();
  const { currentOutlet } = useOutlet();
  const { permissions, loading: permissionsLoading } = useStaffPermissions();
  const { canAccess: canAccessFeature } = useFeatureGating();
  const collapsed = state === "collapsed";

  // permissions === null means owner (no filter). Otherwise filter by allowed keys.
  // During loading, return [] so staff don't see a flash of all items before filtering.
  const getAllowed = <T extends { key: string; feature?: FeatureKey }>(items: T[]): T[] => {
    if (permissionsLoading && profile?.role !== "owner") return [];
    let list = items;
    if (permissions !== null) {
      list = list.filter((item) => permissions.includes(item.key));
    }
    return list.filter((item) => !item.feature || canAccessFeature(item.feature));
  };
  const allowedMain = getAllowed(mainNavItems);
  const allowedOps = getAllowed(operationsItems);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className={`border-b border-sidebar-border ${collapsed ? 'py-3 px-1' : 'p-3'}`}>
        {collapsed ? (
          /* Collapsed: Banaoo mark on top, restaurant icon below */
          <div className="flex flex-col items-center gap-2">
            <img src="/logo.png" alt="Banaoo" className="h-9 w-9 object-contain" />
            {profile?.logo_url ? (
              <img
                src={getImageUrl(profile.logo_url)}
                alt="Restaurant logo"
                className="h-6 w-6 object-contain rounded-md shrink-0 opacity-80"
              />
            ) : (
                <div className="rounded-md bg-muted shrink-0 p-1">
                <img src="/logo.png" alt="Default logo" className="h-4 w-4 object-contain opacity-70" />
              </div>
            )}
          </div>
        ) : (
          /* Expanded: Banaoo logo (primary, left) + restaurant logo (secondary, right) */
          <div className="flex items-center gap-2.5">
            {/* Banaoo — primary brand */}
            <img src="/logo.png" alt="Banaoo" className="h-14 w-14 object-contain shrink-0" />

            {/* Divider */}
            <div className="w-px h-10 bg-border shrink-0" />

            {/* Restaurant — secondary brand */}
            <div className="flex items-center gap-2 min-w-0">
              {profile?.logo_url ? (
                <img
                  src={getImageUrl(profile.logo_url)}
                  alt="Restaurant logo"
                  className="h-14 w-14 object-contain rounded-lg shrink-0"
                />
              ) : (
                <div className="rounded-lg gradient-warm shrink-0 p-3">
                  <img src="/logo.png" alt="Default logo" className="h-6 w-6 object-contain brightness-0 invert" />
                </div>
              )}
              <span className="font-display text-sm font-semibold truncate leading-tight">
                {profile?.brand_name || profile?.full_name || 'My Restaurant'}
              </span>
            </div>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        {allowedMain.length > 0 && (
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2 px-3">
              Main
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {allowedMain.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/dashboard"}
                        className={`flex items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground hover:bg-sidebar-accent w-full ${
                          collapsed ? 'h-10 justify-center' : 'gap-3 px-3 py-2'
                        }`}
                        activeClassName="bg-primary/10 text-primary font-medium"
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </TooltipTrigger>
                    {collapsed && (
                      <TooltipContent side="right">{item.title}</TooltipContent>
                    )}
                  </Tooltip>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        )}

        {allowedOps.length > 0 && (
        <SidebarGroup className="mt-6">
          {!collapsed && (
            <SidebarGroupLabel className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2 px-3">
              Operations
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {allowedOps.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <NavLink
                        to={item.url}
                        className={`flex items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground hover:bg-sidebar-accent w-full ${
                          collapsed ? 'h-10 justify-center' : 'gap-3 px-3 py-2'
                        }`}
                        activeClassName="bg-primary/10 text-primary font-medium"
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </TooltipTrigger>
                    {collapsed && (
                      <TooltipContent side="right">{item.title}</TooltipContent>
                    )}
                  </Tooltip>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border space-y-3">
        {/* Current outlet — read-only display; switch via Settings */}
        {currentOutlet && (
          collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex justify-center p-2">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">{currentOutlet.name}</TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sidebar-accent/50">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground truncate">{currentOutlet.name}</span>
            </div>
          )
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className={`w-full text-muted-foreground hover:text-foreground hover:bg-sidebar-accent ${collapsed ? 'h-10 justify-center px-0' : 'justify-start gap-2'}`}
        >
          {collapsed ? (
            <PanelLeft className="h-5 w-5" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </Button>

        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar className="h-8 w-8 cursor-default">
                  <AvatarFallback className="bg-primary/15 text-primary text-sm font-medium">
                    {profile?.full_name ? getInitials(profile.full_name) : 'U'}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="right">
                {profile?.full_name || 'User'}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={signOut}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-2 rounded-lg bg-sidebar-accent/50">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-primary/15 text-primary text-sm font-medium">
                {profile?.full_name ? getInitials(profile.full_name) : 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile?.full_name || 'User'}</p>
              <p className="text-xs text-muted-foreground truncate capitalize">{profile?.role || 'Owner'}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

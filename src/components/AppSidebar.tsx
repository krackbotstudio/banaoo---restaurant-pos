import {
  ChefHat,
  Store,
  UtensilsCrossed,
  ShoppingCart,
  LayoutDashboard,
  Users,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  Building2,
  ChevronDown,
  Check,
  Settings,
  Link2,
  History,
  BarChart2,
  UserCog,
} from "lucide-react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const mainNavItems = [
  { title: "Dashboard",  url: "/dashboard", icon: LayoutDashboard, key: "dashboard" },
  { title: "Outlets",    url: "/outlets",   icon: Store,           key: "outlets"   },
  { title: "Menu",       url: "/menu",      icon: UtensilsCrossed, key: "menu"      },
];

const operationsItems = [
  { title: "Orders",        url: "/orders",        icon: ShoppingCart, key: "orders"        },
  { title: "Order History", url: "/order-history", icon: History,      key: "order-history" },
  { title: "Customers",     url: "/customers",     icon: Users,        key: "customers"     },
  { title: "Analytics",     url: "/analytics",     icon: BarChart2,    key: "analytics"     },
  { title: "Kitchen",       url: "/kitchen",       icon: ChefHat,      key: "kitchen"       },
  { title: "Staff",         url: "/staff",         icon: UserCog,      key: "staff"         },
  { title: "Integrations",  url: "/integrations",  icon: Link2,        key: "integrations"  },
  { title: "Settings",      url: "/settings",      icon: Settings,     key: "settings"      },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const { profile, signOut, getImageUrl } = useAuth();
  const { currentOutlet, outlets, setCurrentOutlet, canSwitchOutlets } = useOutlet();
  const { permissions } = useStaffPermissions();
  const collapsed = state === "collapsed";

  // permissions === null means owner (no filter). Otherwise filter by allowed keys.
  const allowedMain = permissions === null
    ? mainNavItems
    : mainNavItems.filter((item) => permissions.includes(item.key));
  const allowedOps = permissions === null
    ? operationsItems
    : operationsItems.filter((item) => permissions.includes(item.key));

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const showOutletSwitcher = canSwitchOutlets && outlets.length > 1;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className={`border-b border-sidebar-border ${collapsed ? 'py-3 px-1' : 'p-4'}`}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
          {profile?.logo_url ? (
            <img
              src={getImageUrl(profile.logo_url)}
              alt="Logo"
              className={`object-contain rounded-lg shrink-0 ${collapsed ? 'h-10 w-10' : 'h-9 w-9'}`}
            />
          ) : (
            <div className={`rounded-lg gradient-warm glow-primary shrink-0 ${collapsed ? 'p-2.5' : 'p-2'}`}>
              <ChefHat className={`text-white ${collapsed ? 'h-6 w-6' : 'h-5 w-5'}`} />
            </div>
          )}
          {!collapsed && (
            <span className="font-display text-xl font-semibold truncate">
              {profile?.brand_name || profile?.full_name || 'My Restaurant'}
            </span>
          )}
        </div>
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
        {/* Outlet Switcher - Only visible for owners/managers with multiple outlets */}
        {showOutletSwitcher && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-full h-10 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                    >
                      <Building2 className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {currentOutlet?.name || "Select outlet"}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  variant="ghost"
                  className="w-full justify-between h-10 px-3 text-left hover:bg-sidebar-accent"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium">
                      {currentOutlet?.name || "Select outlet"}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Button>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {outlets.map((outlet) => (
                <DropdownMenuItem
                  key={outlet.id}
                  onClick={() => setCurrentOutlet(outlet)}
                  className="flex items-center justify-between"
                >
                  <span className="truncate">{outlet.name}</span>
                  {currentOutlet?.id === outlet.id && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Single outlet display (non-switcher) */}
        {currentOutlet && !showOutletSwitcher && (
          collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex justify-center p-2">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                {currentOutlet.name}
              </TooltipContent>
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

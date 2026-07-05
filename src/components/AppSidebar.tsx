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
  IndianRupee,
} from "lucide-react";
import { useFeatureGating } from "@/hooks/use-feature-gating";
import type { FeatureKey } from "@/hooks/use-feature-gating";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/lib/auth";
import { useOutlet } from "@/lib/outlet-context";
import { useStaffPermissions } from "@/lib/use-staff-permissions";
import { getBusinessType, type BusinessType } from "@/lib/business-types";
import type { OutletOperationMode } from "@/lib/outlet-operation";

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

interface NavItem {
  title: string;
  url: string;
  icon: typeof ShoppingCart;
  key: string;
  feature?: FeatureKey;
  /** When set, item only renders for these business types. */
  businessTypes?: BusinessType[];
  /** When set, item only renders for outlets in these operation modes. */
  operationModes?: OutletOperationMode[];
}

interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

/**
 * Sidebar order follows the restaurant user journey:
 * overview → daily service (menu → order → kitchen → pay → history) →
 * guests & insights → back office → system setup.
 */
const NAV_SECTIONS: NavSection[] = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, key: "dashboard" },
    ],
  },
  {
    id: "service",
    label: "Daily service",
    items: [
      { title: "Menu", url: "/menu", icon: UtensilsCrossed, key: "menu" },
      { title: "Orders", url: "/orders", icon: ShoppingCart, key: "orders" },
      { title: "Kitchen", url: "/kitchen", icon: ChefHat, key: "kitchen" },
      { title: "Payments", url: "/payments", icon: IndianRupee, key: "payments" },
      { title: "Order History", url: "/order-history", icon: History, key: "order-history" },
    ],
  },
  {
    id: "business",
    label: "Guests & business",
    items: [
      { title: "Customers", url: "/customers", icon: Users, key: "customers" },
      { title: "Analytics", url: "/analytics", icon: BarChart2, key: "analytics" },
      {
        title: "Inventory",
        url: "/inventory",
        icon: Boxes,
        key: "inventory",
        feature: "inventoryManagement",
      },
    ],
  },
  {
    id: "admin",
    label: "Team & setup",
    items: [
      { title: "Staff", url: "/staff", icon: UserCog, key: "staff" },
      { title: "Integrations", url: "/integrations", icon: Link2, key: "integrations" },
      { title: "Settings", url: "/settings", icon: Settings, key: "settings" },
    ],
  },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const { profile, signOut, getImageUrl } = useAuth();
  const { currentOutlet } = useOutlet();
  const { permissions, loading: permissionsLoading } = useStaffPermissions();
  const { canAccess: canAccessFeature, loading: featuresLoading } = useFeatureGating();
  const navReady = !permissionsLoading && !featuresLoading && profile != null;
  const collapsed = state === "collapsed";
  const businessTypeDef = getBusinessType(profile?.business_type);

  const businessType = profile?.business_type as BusinessType | null | undefined;
  const operationMode = currentOutlet?.operation_mode as OutletOperationMode | null | undefined;

  // permissions === null means owner (no filter). Otherwise filter by allowed keys.
  // During loading, return [] so staff don't see a flash of all items before filtering.
  // Items can also opt into business_type / operation_mode gates (NavItem fields).
  const getAllowed = <T extends NavItem>(items: T[]): T[] => {
    if (!navReady) {
      return profile?.role === "owner" ? items : [];
    }
    if (permissionsLoading && profile?.role !== "owner") return [];
    let list = items;
    if (permissions !== null && permissions !== undefined) {
      list = list.filter((item) => permissions.includes(item.key));
    }
    list = list.filter((item) => !item.feature || canAccessFeature(item.feature));
    list = list.filter(
      (item) =>
        !item.businessTypes ||
        (businessType && item.businessTypes.includes(businessType))
    );
    list = list.filter(
      (item) =>
        !item.operationModes ||
        (operationMode && item.operationModes.includes(operationMode))
    );
    return list;
  };
  const allowedSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: getAllowed(section.items),
  })).filter((section) => section.items.length > 0);

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
      <SidebarHeader className={`border-b border-sidebar-border shrink-0 ${collapsed ? "py-2.5 px-1" : "px-3 py-2.5"}`}>
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
          <div className="flex items-center gap-2 min-w-0">
            {/* Banaoo — primary brand */}
            <img src="/logo.png" alt="Banaoo" className="h-11 w-11 object-contain shrink-0" />

            {/* Divider */}
            <div className="w-px h-9 bg-border shrink-0" />

            {/* Restaurant — secondary brand */}
            <div className="flex items-center gap-2 min-w-0">
              {profile?.logo_url ? (
                <img
                  src={getImageUrl(profile.logo_url)}
                  alt="Restaurant logo"
                  className="h-11 w-11 object-contain rounded-lg shrink-0"
                />
              ) : (
                <div className="rounded-lg gradient-warm shrink-0 p-2.5">
                  <img src="/logo.png" alt="Default logo" className="h-5 w-5 object-contain brightness-0 invert" />
                </div>
              )}
              <div className="flex flex-col min-w-0 gap-0.5">
                <span className="font-display text-sm font-semibold truncate leading-tight">
                  {profile?.brand_name || profile?.full_name || 'My Restaurant'}
                </span>
                {businessTypeDef && (
                  <span className="self-start text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/10 text-primary leading-none">
                    {businessTypeDef.label}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="flex-1 gap-0 px-2 py-2 overflow-y-auto">
        {allowedSections.map((section, sectionIndex) => (
          <SidebarGroup key={section.id} className={`p-0 ${sectionIndex > 0 ? "mt-3" : ""}`}>
            {!collapsed && (
              <SidebarGroupLabel className="h-7 mb-1 px-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {section.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.key}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <NavLink
                          to={item.url}
                          end={item.url === "/dashboard"}
                          data-tour={`nav-${item.key}`}
                          className={`flex items-center rounded-lg text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-sidebar-accent w-full ${
                            collapsed ? "h-10 justify-center" : "gap-2.5 px-3 py-2"
                          }`}
                          activeClassName="bg-primary/10 text-primary font-medium"
                        >
                          <item.icon className="h-[18px] w-[18px] shrink-0" />
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
        ))}
      </SidebarContent>

      <SidebarFooter className="shrink-0 p-2.5 border-t border-sidebar-border space-y-2">
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
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-sidebar-accent/50">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground truncate">{currentOutlet.name}</span>
            </div>
          )
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className={`w-full h-9 text-sm text-muted-foreground hover:text-foreground hover:bg-sidebar-accent ${collapsed ? "justify-center px-0" : "justify-start gap-2"}`}
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
          <div className="flex items-center gap-2.5 p-2 rounded-lg bg-sidebar-accent/50">
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

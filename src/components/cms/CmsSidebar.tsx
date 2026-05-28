import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Wallet,
  Megaphone,
  Image,
  Shield,
  LogOut,
  ExternalLink,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCmsAuth } from "@/lib/cms-auth";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const NAV = [
  { title: "Dashboard", url: "/cms/dashboard", icon: LayoutDashboard },
  { title: "Customers", url: "/cms/customers", icon: Users },
  { title: "Subscriptions", url: "/cms/subscriptions", icon: CreditCard },
  { title: "Payments", url: "/cms/payments", icon: Wallet },
  { title: "Marketing", url: "/cms/marketing", icon: Megaphone },
  { title: "Dashboard banners", url: "/cms/banners", icon: Image },
  { title: "Roles & access", url: "/cms/roles", icon: Shield },
];

export function CmsSidebar() {
  const { admin, signOut } = useCmsAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { state, toggleSidebar, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";

  const closeMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/cms/login", { replace: true });
    closeMobile();
  };

  const isActive = (url: string) =>
    location.pathname === url || location.pathname.startsWith(`${url}/`);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader
        className={cn(
          "border-b border-sidebar-border shrink-0",
          collapsed ? "py-2.5 px-1" : "px-3 py-3"
        )}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <img src="/tectangle-logo.png" alt="Tectangle" className="h-8 w-8 object-contain" />
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <img src="/tectangle-logo.png" alt="Tectangle" className="h-9 w-9 object-contain shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-sm leading-tight truncate">Tectangle CMS</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">banaoo platform</p>
            </div>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        <SidebarMenu>
          {NAV.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton
                asChild
                isActive={isActive(item.url)}
                tooltip={item.title}
                className={cn(
                  isActive(item.url) && "bg-primary/10 text-primary font-medium hover:bg-primary/10 hover:text-primary"
                )}
              >
                <NavLink to={item.url} onClick={closeMobile}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2 space-y-1">
        {admin && !collapsed && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            <p className="font-medium text-foreground truncate">{admin.full_name || admin.email}</p>
            <p className="capitalize">{admin.role.replace("_", " ")}</p>
          </div>
        )}
        {admin && collapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex justify-center py-1">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-accent text-xs font-semibold">
                  {(admin.full_name || admin.email || "?").charAt(0).toUpperCase()}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">{admin.full_name || admin.email}</TooltipContent>
          </Tooltip>
        )}

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Public site" className="h-9">
              <a href="/" target="_blank" rel="noopener noreferrer" onClick={closeMobile}>
                <ExternalLink className="h-4 w-4" />
                <span>Public site</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign out"
              className="h-9 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => void handleSignOut()}
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="h-9 hidden md:flex"
              onClick={toggleSidebar}
            >
              {collapsed ? (
                <PanelLeft className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
              <span>{collapsed ? "Expand" : "Collapse"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

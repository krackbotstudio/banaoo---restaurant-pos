import { Outlet } from "react-router-dom";
import { CmsSidebar } from "./CmsSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export function CmsLayout() {
  return (
    <SidebarProvider defaultOpen className="h-svh min-h-0 w-full overflow-hidden">
      <div className="flex h-svh w-full min-h-0 overflow-hidden">
        <CmsSidebar />
        <SidebarInset className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6">
            <SidebarTrigger className="-ml-1" />
            <p className="text-sm font-semibold md:hidden">Tectangle CMS</p>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8">
            <Outlet />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

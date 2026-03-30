import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChefHat, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

interface PageHeaderProps {
  title: string;
  icon?: React.ReactNode;
  showBack?: boolean;
  backTo?: string;
  showLogout?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  icon,
  showBack = false,
  backTo = "/",
  showLogout = false,
  children,
  className,
}: PageHeaderProps) {
  const { signOut, profile, user } = useAuth();

  return (
    <header className={cn("sticky top-0 z-50 glass-strong", className)}>
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          {showBack ? (
            <Button asChild variant="ghost" size="icon" className="hover:bg-primary/10">
              <Link to={backTo}>
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
          ) : (
            <Link to="/" className="flex items-center gap-3 group">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl gradient-primary glow-primary transition-transform group-hover:scale-105">
                <ChefHat className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-display text-xl font-bold hidden sm:block">banaoo.io</span>
            </Link>
          )}
          {showBack && (
            <div className="flex items-center gap-2">
              {icon}
              <h1 className="font-display text-lg font-semibold">{title}</h1>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {children}
          {showLogout && (
            <>
              <span className="text-sm text-muted-foreground hidden sm:block">
                {profile?.full_name || user?.email}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
                className="hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

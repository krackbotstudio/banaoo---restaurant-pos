import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChefHat, Home } from "lucide-react";

export default function NotFound() {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse-slow" />
      </div>

      <div className="text-center relative z-10 space-y-8">
        <div className="flex justify-center">
          <div className="h-24 w-24 rounded-3xl gradient-primary glow-primary flex items-center justify-center animate-float">
            <ChefHat className="h-12 w-12 text-primary-foreground" />
          </div>
        </div>
        
        <div className="space-y-4">
          <h1 className="font-display text-8xl font-bold text-primary">404</h1>
          <h2 className="font-display text-2xl font-semibold">Page Not Found</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Oops! Looks like this page got lost in the kitchen.
          </p>
        </div>

        <Button asChild className="gradient-primary glow-primary h-12 px-8">
          <Link to="/">
            <Home className="h-5 w-5 mr-2" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}
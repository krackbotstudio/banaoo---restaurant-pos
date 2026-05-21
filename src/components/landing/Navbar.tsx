import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, ChevronDown, QrCode } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const brandNames = [
  "banaoo",   // English
  "बनाओ",     // Hindi
  "బనావో",   // Telugu
  "பனாவோ",  // Tamil
  "ബനാവോ",  // Malayalam
  "ಬನಾವೋ",  // Kannada
  "بنائو",    // Urdu
];

const tools = [
  {
    name: "QR Menu Builder",
    description: "Create digital menus with QR codes",
    href: "/tools/qr-menu-builder",
    icon: QrCode,
  },
];

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, profile, loading } = useAuth();
  const location = useLocation();
  const pricingHref = location.pathname === "/" ? "/#pricing" : "/pricing";

  // Brand name typing animation
  const [typedBrand, setTypedBrand] = useState("banaoo");
  const [brandIdx, setBrandIdx] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const current = brandNames[brandIdx];
    const isFull = typedBrand === current;
    const delay = isDeleting ? 50 : isFull ? 2000 : 90;

    const t = setTimeout(() => {
      if (!isDeleting) {
        if (!isFull) {
          setTypedBrand(current.slice(0, typedBrand.length + 1));
        } else {
          setIsDeleting(true);
        }
      } else {
        if (typedBrand.length > 0) {
          setTypedBrand(current.slice(0, typedBrand.length - 1));
        } else {
          setIsDeleting(false);
          setBrandIdx((i) => (i + 1) % brandNames.length);
        }
      }
    }, delay);

    return () => clearTimeout(t);
  }, [typedBrand, brandIdx, isDeleting]);

  const dashboardHref = profile && !profile.onboarding_completed ? "/onboarding" : "/dashboard";
  const dashboardLabel = profile && !profile.onboarding_completed ? "Complete Setup" : "Go to Dashboard";

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="banaoo.io" className="h-9 w-9 object-contain" />
          <span className="text-xl font-bold min-w-[5rem] inline-block">
            {typedBrand}
            <span className="inline-block w-0.5 h-4 bg-foreground ml-0.5 align-middle animate-pulse" />
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <Link to="/" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Home
          </Link>

          {/* Tools Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors outline-none">
              Tools
              <ChevronDown className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              {tools.map((tool) => (
                <DropdownMenuItem key={tool.href} asChild>
                  <Link to={tool.href} className="flex items-start gap-3 p-3">
                    <tool.icon className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <div className="font-medium">{tool.name}</div>
                      <div className="text-xs text-muted-foreground">{tool.description}</div>
                    </div>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Link to={pricingHref} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Pricing
          </Link>
          <Link to="/docs" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Docs
          </Link>
          <Link to="/about" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            About
          </Link>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {loading ? (
            <div className="w-32 h-9" />
          ) : user ? (
            <Button asChild>
              <Link to={dashboardHref}>{dashboardLabel}</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link to="/auth">Sign In</Link>
              </Button>
              <Button asChild>
                <Link to="/auth">Get Started</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t bg-background">
          <nav className="container py-4 flex flex-col gap-3">
            <Link
              to="/"
              className="text-sm font-medium py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Home
            </Link>

            {/* Tools Section */}
            <div className="py-2">
              <div className="text-sm font-medium text-muted-foreground mb-2">Tools</div>
              {tools.map((tool) => (
                <Link
                  key={tool.href}
                  to={tool.href}
                  className="flex items-center gap-3 py-2 pl-4"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <tool.icon className="h-4 w-4 text-primary" />
                  <span className="text-sm">{tool.name}</span>
                </Link>
              ))}
            </div>

            <Link
              to={pricingHref}
              className="text-sm font-medium py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Pricing
            </Link>
            <Link
              to="/docs"
              className="text-sm font-medium py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Docs
            </Link>
            <Link 
              to="/about" 
              className="text-sm font-medium py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              About
            </Link>
            <div className="flex flex-col gap-2 pt-3 border-t">
              {loading ? (
                <div className="h-10" />
              ) : user ? (
                <Button asChild>
                  <Link to={dashboardHref} onClick={() => setMobileMenuOpen(false)}>{dashboardLabel}</Link>
                </Button>
              ) : (
                <>
                  <Button variant="outline" asChild>
                    <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>Sign In</Link>
                  </Button>
                  <Button asChild>
                    <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>Get Started</Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

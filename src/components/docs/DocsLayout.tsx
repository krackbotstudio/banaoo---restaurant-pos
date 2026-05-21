import type { ReactNode } from "react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

interface DocsLayoutProps {
  title: string;
  description?: string;
  lastUpdated?: string;
  breadcrumbs?: { label: string; href?: string }[];
  children: ReactNode;
}

export function DocsLayout({
  title,
  description,
  lastUpdated,
  breadcrumbs,
  children,
}: DocsLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 py-10 md:py-14">
        <div className="container">
          <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-8 flex-wrap">
            <Link to="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <ChevronRight className="h-4 w-4 shrink-0" />
            <Link to="/docs" className="hover:text-foreground transition-colors">
              Documentation
            </Link>
            {breadcrumbs?.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                <ChevronRight className="h-4 w-4 shrink-0" />
                {crumb.href ? (
                  <Link to={crumb.href} className="hover:text-foreground transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-foreground font-medium">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>

          <div className="grid gap-10 lg:grid-cols-[240px_1fr] xl:grid-cols-[260px_1fr]">
            <DocsSidebar className="hidden lg:block sticky top-24 self-start max-h-[calc(100vh-8rem)] overflow-y-auto" />

            <div className="min-w-0">
              <header className="mb-8 space-y-2">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{title}</h1>
                {description && (
                  <p className="text-lg text-muted-foreground max-w-2xl">{description}</p>
                )}
                {lastUpdated && (
                  <p className="text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
                )}
              </header>
              {children}
            </div>
          </div>

          <div className="lg:hidden mt-10 pt-8 border-t">
            <p className="text-sm font-semibold mb-4">Browse topics</p>
            <DocsSidebar />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

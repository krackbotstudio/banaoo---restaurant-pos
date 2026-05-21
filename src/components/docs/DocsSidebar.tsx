import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { DOC_ARTICLES, DOC_SECTIONS, getDocArticlesBySection } from "@/content/docs/registry";
import { BookOpen } from "lucide-react";

export function DocsSidebar({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const currentSlug = pathname.startsWith("/docs/") ? pathname.replace("/docs/", "").split("/")[0] : null;

  return (
    <aside className={cn("space-y-6", className)}>
      <Link
        to="/docs"
        className={cn(
          "flex items-center gap-2 text-sm font-semibold rounded-lg px-3 py-2 transition-colors",
          pathname === "/docs" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
        )}
      >
        <BookOpen className="h-4 w-4 shrink-0" />
        All documentation
      </Link>

      {DOC_SECTIONS.map((section) => {
        const articles = getDocArticlesBySection(section.id);
        if (articles.length === 0) return null;
        return (
          <div key={section.id} className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-3">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {articles.map((article) => (
                <li key={article.slug}>
                  <Link
                    to={`/docs/${article.slug}`}
                    className={cn(
                      "block text-sm rounded-lg px-3 py-2 transition-colors",
                      currentSlug === article.slug
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}
                  >
                    {article.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <p className="text-xs text-muted-foreground px-3 pt-2 border-t">
        {DOC_ARTICLES.length} articles · Updated regularly with product releases
      </p>
    </aside>
  );
}

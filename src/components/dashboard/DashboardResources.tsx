import { Link } from "react-router-dom";
import { DOC_ARTICLES } from "@/content/docs/registry";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, ArrowRight, ExternalLink } from "lucide-react";

const FEATURED_SLUGS = [
  "getting-started",
  "orders-and-pos",
  "kitchen",
  "billing-and-receipts",
  "faq-troubleshooting",
];

export function DashboardResources() {
  const featured = FEATURED_SLUGS.map((slug) => DOC_ARTICLES.find((a) => a.slug === slug)).filter(
    Boolean
  ) as typeof DOC_ARTICLES;

  return (
    <section data-tour="dashboard-resources" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Guides & resources
          </h3>
        </div>
        <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
          <Link to="/docs">
            All docs
            <ExternalLink className="h-3 w-3 ml-1" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {featured.map((article) => (
          <Link key={article.slug} to={`/docs/${article.slug}`}>
            <Card className="h-full group hover:border-primary/30 hover:shadow-sm transition-all">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-1">
                  {article.title}
                </CardTitle>
                <CardDescription className="text-xs line-clamp-2">
                  {article.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-4 pt-0">
                <span className="inline-flex items-center text-xs text-muted-foreground group-hover:text-primary transition-colors">
                  Read guide
                  <ArrowRight className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}

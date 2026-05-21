import { Link } from "react-router-dom";
import { DocsLayout } from "@/components/docs/DocsLayout";
import { DOC_SECTIONS, getDocArticlesBySection, formatDocDate } from "@/content/docs/registry";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, BookOpen, HelpCircle, Printer, UtensilsCrossed } from "lucide-react";

const sectionIcons: Record<string, typeof BookOpen> = {
  start: BookOpen,
  operations: UtensilsCrossed,
  hardware: Printer,
  help: HelpCircle,
};

export default function Docs() {
  return (
    <DocsLayout
      title="Documentation"
      description="Guides for setting up and running your restaurant on banaoo — POS, kitchen, billing, printers, and the Android app."
    >
      <div className="grid gap-6 sm:grid-cols-2 mb-10">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">New to banaoo?</CardTitle>
            <CardDescription>Start here in under 10 minutes</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              to="/docs/getting-started"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              Getting started guide
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Print issues?</CardTitle>
            <CardDescription>Bluetooth, LAN, fleet, and APK setup</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              to="/docs/printers"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              Printer documentation
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-10">
        {DOC_SECTIONS.map((section) => {
          const articles = getDocArticlesBySection(section.id);
          const Icon = sectionIcons[section.id] ?? BookOpen;
          return (
            <section key={section.id} className="space-y-4">
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">{section.title}</h2>
              </div>
              <ul className="grid gap-4 sm:grid-cols-2">
                {articles.map((article) => (
                  <li key={article.slug}>
                    <Link
                      to={`/docs/${article.slug}`}
                      className="block h-full rounded-xl border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/30"
                    >
                      <h3 className="font-semibold mb-1">{article.title}</h3>
                      <p className="text-sm text-muted-foreground mb-3">{article.description}</p>
                      <p className="text-xs text-muted-foreground">
                        Updated {formatDocDate(article.lastUpdated)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="mt-12 text-sm text-muted-foreground">
        Can&apos;t find an answer?{" "}
        <Link to="/docs/faq-troubleshooting" className="text-primary underline underline-offset-2">
          FAQ & troubleshooting
        </Link>{" "}
        or email{" "}
        <a href="mailto:connect@banaoo.in" className="text-primary underline underline-offset-2">
          connect@banaoo.in
        </a>
        .
      </p>
    </DocsLayout>
  );
}

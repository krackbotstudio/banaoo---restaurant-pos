import { Link, useParams, Navigate } from "react-router-dom";
import { DocsLayout } from "@/components/docs/DocsLayout";
import { DocsMarkdown } from "@/components/docs/DocsMarkdown";
import {
  DOC_ARTICLES,
  formatDocDate,
  getDocArticle,
} from "@/content/docs/registry";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { SEO, StructuredData, buildBreadcrumbList } from "@/components/seo/SEO";

export default function DocsArticle() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) return <Navigate to="/docs" replace />;

  const article = getDocArticle(slug);
  if (!article) return <Navigate to="/docs" replace />;

  const index = DOC_ARTICLES.findIndex((a) => a.slug === slug);
  const prev = index > 0 ? DOC_ARTICLES[index - 1] : null;
  const next = index >= 0 && index < DOC_ARTICLES.length - 1 ? DOC_ARTICLES[index + 1] : null;

  const articleUrl = `https://banaoo.io/docs/${article.slug}`;

  return (
    <>
      <SEO
        title={article.title}
        description={article.description}
        path={`/docs/${article.slug}`}
        type="article"
        publishedTime={article.lastUpdated}
        modifiedTime={article.lastUpdated}
        author="banaoo"
      />
      <StructuredData
        data={buildBreadcrumbList([
          { name: "Home", path: "/" },
          { name: "Documentation", path: "/docs" },
          { name: article.title, path: `/docs/${article.slug}` },
        ])}
      />
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "TechArticle",
          headline: article.title,
          description: article.description,
          datePublished: article.lastUpdated,
          dateModified: article.lastUpdated,
          author: { "@type": "Organization", name: "banaoo", url: "https://banaoo.io" },
          publisher: {
            "@type": "Organization",
            name: "banaoo",
            url: "https://banaoo.io",
            logo: {
              "@type": "ImageObject",
              url: "https://banaoo.io/logo.png",
            },
          },
          mainEntityOfPage: { "@type": "WebPage", "@id": articleUrl },
          inLanguage: "en",
          articleSection: article.sectionTitle,
        }}
      />
    <DocsLayout
      title={article.title}
      description={article.description}
      lastUpdated={formatDocDate(article.lastUpdated)}
      breadcrumbs={[{ label: article.title }]}
    >
      <article className="docs-article">
        <DocsMarkdown content={article.body} />
      </article>

      <div className="mt-12 pt-8 border-t flex flex-col sm:flex-row gap-4 justify-between">
        {prev ? (
          <Button variant="outline" asChild className="justify-start h-auto py-3">
            <Link to={`/docs/${prev.slug}`} className="flex flex-col items-start gap-1">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <ArrowLeft className="h-3 w-3" /> Previous
              </span>
              <span className="font-medium">{prev.title}</span>
            </Link>
          </Button>
        ) : (
          <div />
        )}
        {next ? (
          <Button variant="outline" asChild className="justify-end h-auto py-3 sm:ml-auto">
            <Link to={`/docs/${next.slug}`} className="flex flex-col items-end gap-1 text-right">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                Next <ArrowRight className="h-3 w-3" />
              </span>
              <span className="font-medium">{next.title}</span>
            </Link>
          </Button>
        ) : null}
      </div>
    </DocsLayout>
    </>
  );
}

import { Helmet } from "react-helmet-async";

const SITE_URL = "https://banaoo.io";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;
const DEFAULT_TITLE = "banaoo — One App to Run Your Restaurant";
const DEFAULT_DESCRIPTION =
  "POS, online orders, kitchen display & payments — purpose-built for Indian restaurants, cloud kitchens, QSRs and self-service counters.";

export interface SEOProps {
  /** Page-specific title. Will be appended with " — banaoo" unless `disableSuffix` is true. */
  title?: string;
  /** Pass true to use the title verbatim (e.g. for the homepage). */
  disableSuffix?: boolean;
  /** Page-specific meta description. */
  description?: string;
  /**
   * Path for canonical/og:url, e.g. "/about" — leading slash required.
   * Defaults to "/" if omitted (use only on the homepage).
   */
  path?: string;
  /** Absolute or relative URL for og:image / twitter:image. */
  image?: string;
  /** og:type — defaults to "website". Use "article" on docs/blog pages. */
  type?: "website" | "article" | "product";
  /** Set to true to mark a page noindex (drafts, internal redirects, etc.). */
  noindex?: boolean;
  /** Optional list of keywords for the keywords meta tag. */
  keywords?: string[];
  /** ISO date for article:published_time when type === "article". */
  publishedTime?: string;
  /** ISO date for article:modified_time when type === "article". */
  modifiedTime?: string;
  /** Author name for article:author when type === "article". */
  author?: string;
  /** Children render extra <meta>/<script type="application/ld+json"> tags. */
  children?: React.ReactNode;
}

/**
 * Per-route SEO component. Wraps react-helmet-async.
 *
 * Usage:
 *   <SEO
 *     title="About"
 *     description="Learn why banaoo was built — for restaurant owners, by restaurant owners."
 *     path="/about"
 *   />
 */
export function SEO({
  title,
  disableSuffix = false,
  description = DEFAULT_DESCRIPTION,
  path = "/",
  image,
  type = "website",
  noindex = false,
  keywords,
  publishedTime,
  modifiedTime,
  author,
  children,
}: SEOProps) {
  const fullTitle = title
    ? disableSuffix
      ? title
      : `${title} — banaoo`
    : DEFAULT_TITLE;

  const url = `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const ogImage = image
    ? image.startsWith("http")
      ? image
      : `${SITE_URL}${image.startsWith("/") ? image : `/${image}`}`
    : DEFAULT_OG_IMAGE;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {keywords && keywords.length > 0 && (
        <meta name="keywords" content={keywords.join(", ")} />
      )}
      {noindex && (
        <meta name="robots" content="noindex,nofollow,max-image-preview:none" />
      )}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:alt" content={fullTitle} />

      {/* Twitter */}
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Article meta when applicable */}
      {type === "article" && publishedTime && (
        <meta property="article:published_time" content={publishedTime} />
      )}
      {type === "article" && modifiedTime && (
        <meta property="article:modified_time" content={modifiedTime} />
      )}
      {type === "article" && author && (
        <meta property="article:author" content={author} />
      )}

      {children}
    </Helmet>
  );
}

/**
 * Embed JSON-LD structured data. Pass any schema.org object as `data`.
 *
 * Example:
 *   <StructuredData data={{
 *     "@context": "https://schema.org",
 *     "@type": "BreadcrumbList",
 *     "itemListElement": [...]
 *   }} />
 */
export function StructuredData({ data }: { data: Record<string, unknown> }) {
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(data)}</script>
    </Helmet>
  );
}

/**
 * Build a BreadcrumbList structured-data payload from an ordered list of
 * {name, path} pairs. The first entry is treated as Home.
 */
export function buildBreadcrumbList(
  trail: Array<{ name: string; path: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.name,
      item: `${SITE_URL}${t.path.startsWith("/") ? t.path : `/${t.path}`}`,
    })),
  };
}

/** Convenience FAQPage builder. */
export function buildFaqPage(items: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.question,
      acceptedAnswer: { "@type": "Answer", text: it.answer },
    })),
  };
}

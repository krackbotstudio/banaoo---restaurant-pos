import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router-dom";

interface DocsMarkdownProps {
  content: string;
}

function DocLink({
  href,
  children,
}: {
  href?: string;
  children?: React.ReactNode;
}) {
  if (!href) return <span>{children}</span>;
  if (href.startsWith("/")) {
    return (
      <Link to={href} className="text-primary underline underline-offset-2 hover:text-primary/90">
        {children}
      </Link>
    );
  }
  if (href.startsWith("mailto:") || href.startsWith("http")) {
    return (
      <a
        href={href}
        className="text-primary underline underline-offset-2"
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      >
        {children}
      </a>
    );
  }
  return (
    <a href={href} className="text-primary underline underline-offset-2">
      {children}
    </a>
  );
}

export function DocsMarkdown({ content }: DocsMarkdownProps) {
  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none prose-headings:scroll-mt-24 prose-a:no-underline prose-pre:bg-muted prose-pre:text-foreground prose-table:text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => <DocLink href={href}>{children}</DocLink>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

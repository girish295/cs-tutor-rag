"use client";

/**
 * Markdown renderer for assistant messages.
 *
 * Most element styling lives in the `.prose-chat` rules in `globals.css`;
 * components are overridden here only where behaviour is needed — a copy button
 * on code blocks, safe link handling, and citation markers.
 */

import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function CodeBlock({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    // Read the rendered text rather than reaching into React children, which
    // may be a nested element tree rather than a plain string.
    const text = typeof children === "string" ? children : extractText(children);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be denied; failing silently is better than an alert.
    }
  };

  return (
    <div className="group relative">
      <pre>{children}</pre>
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 rounded-md border px-2 py-1 text-[11px] font-medium opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        style={{
          borderColor: "var(--border-2)",
          background: "var(--surface-1)",
          color: copied ? "var(--good)" : "var(--ink-2)",
        }}
        aria-label="Copy code"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function extractText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return extractText((node as { props: { children?: React.ReactNode } }).props.children);
  }
  return "";
}

export const Markdown = memo(function Markdown({ content }: { content: string }) {
  return (
    <div className="prose-chat">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              // noreferrer/nofollow because link targets can come from web
              // search results, which are untrusted third-party content.
              rel="noopener noreferrer nofollow"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

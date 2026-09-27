"use client";

/**
 * Renders the `searchKnowledgeBase` tool result: the Retrieval Inspector.
 *
 * This component is the reason the RAG in this project is verifiable rather than
 * a claim. It shows the exact query the model chose, which retrievers ran, how
 * long it took, and every passage that was fed to the model — so a reader can
 * check whether a cited answer is actually supported. Collapsed by default so it
 * informs without dominating the transcript.
 */

import { useState } from "react";

import { Badge, ToolShell } from "@/components/ui/primitives";

export interface RetrievalPayload {
  query: string;
  found: number;
  retrieversUsed?: string[];
  timingMs?: number;
  availableTopics?: string[];
  note?: string;
  citations?: {
    id: string;
    label?: string;
    docId: string;
    docTitle: string;
    heading: string;
    topic: string;
    snippet: string;
    score: number;
    text?: string;
  }[];
}

export function RetrievalPanel({ data }: { data: RetrievalPayload }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const citations = data.citations ?? [];
  const documentCount = new Set(citations.map((citation) => citation.docId)).size;

  return (
    <ToolShell
      icon={<SearchIcon />}
      title="Knowledge base"
      subtitle={
        <span className="flex flex-wrap items-center gap-x-2">
          <code className="text-[11px]" style={{ color: "var(--ink-2)" }}>
            “{data.query}”
          </code>
        </span>
      }
      badge={
        <div className="flex items-center gap-1.5">
          <Badge tone={citations.length > 0 ? "good" : "warn"}>
            {citations.length > 0
              ? `${citations.length} passage${citations.length === 1 ? "" : "s"}`
              : "no match"}
          </Badge>
          {citations.length > 0 ? (
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="rounded-md px-2 py-1 text-[11px] font-medium"
              style={{ background: "var(--surface-3)", color: "var(--ink-2)" }}
              aria-expanded={open}
            >
              {open ? "Hide sources" : "Show sources"}
            </button>
          ) : null}
        </div>
      }
    >
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-[11px] sm:px-4"
        style={{ color: "var(--ink-3)" }}
      >
        {data.retrieversUsed && data.retrieversUsed.length > 0 ? (
          <span>
            retrievers:{" "}
            <strong style={{ color: "var(--ink-2)" }}>
              {data.retrieversUsed
                .map((name) => (name === "bm25" ? "BM25 (sparse)" : "vectors (dense)"))
                .join(" + ")}
            </strong>
          </span>
        ) : null}
        {documentCount > 0 ? (
          <span>
            across <strong style={{ color: "var(--ink-2)" }}>{documentCount}</strong>{" "}
            document{documentCount === 1 ? "" : "s"}
          </span>
        ) : null}
        {typeof data.timingMs === "number" ? <span>{data.timingMs}ms</span> : null}
      </div>

      {citations.length === 0 ? (
        <p className="px-3 pb-3 text-sm sm:px-4" style={{ color: "var(--ink-2)" }}>
          Nothing in the knowledge base matched this query.
          {data.availableTopics && data.availableTopics.length > 0 ? (
            <>
              {" "}
              Topics covered: {data.availableTopics.join(", ")}.
            </>
          ) : null}
        </p>
      ) : null}

      {open && citations.length > 0 ? (
        <ul className="border-t" style={{ borderColor: "var(--border-1)" }}>
          {citations.map((citation) => {
            const isExpanded = expanded === citation.id;
            return (
              <li
                key={citation.id}
                className="border-b last:border-b-0"
                style={{ borderColor: "var(--border-1)" }}
              >
                <div className="px-3 py-2.5 sm:px-4">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span
                      className="font-mono text-[11px] font-semibold"
                      style={{ color: "var(--accent)" }}
                    >
                      {citation.label ?? "—"}
                    </span>
                    <span
                      className="text-[13px] font-semibold"
                      style={{ color: "var(--ink-1)" }}
                    >
                      {citation.docTitle}
                    </span>
                    <span className="text-[11px]" style={{ color: "var(--ink-3)" }}>
                      › {citation.heading}
                    </span>
                    <span
                      className="ml-auto font-mono text-[10px] tabular-nums"
                      style={{ color: "var(--ink-3)" }}
                      title="Reciprocal rank fusion score"
                    >
                      {citation.score.toFixed(4)}
                    </span>
                  </div>
                  <p
                    className="mt-1.5 text-[13px] leading-relaxed"
                    style={{ color: "var(--ink-2)" }}
                  >
                    {isExpanded && citation.text ? citation.text : citation.snippet}
                  </p>
                  {citation.text && citation.text.length > citation.snippet.length ? (
                    <button
                      type="button"
                      onClick={() => setExpanded(isExpanded ? null : citation.id)}
                      className="mt-1.5 text-[11px] font-medium"
                      style={{ color: "var(--accent)" }}
                    >
                      {isExpanded ? "Show less" : "Show full passage"}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </ToolShell>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
      <circle cx={9} cy={9} r={5.25} stroke="currentColor" strokeWidth={1.6} />
      <path
        d="M13 13l3.5 3.5"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </svg>
  );
}

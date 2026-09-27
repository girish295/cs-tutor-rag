"use client";

/**
 * The sidebar: a browsable view of what the chatbot actually knows.
 *
 * Deliberately content-first — it lists the knowledge base and lets you scope
 * retrieval to a topic, rather than reporting internal system state.
 */

import { useMemo, useState } from "react";

export interface CorpusInfo {
  documents: number;
  chunks: number;
  topics: string[];
  averageChunkTokens: number;
  titles: { id: string; title: string; topic: string; difficulty: string }[];
}

export function Sidebar({
  corpus,
  topic,
  onTopicChange,
}: {
  corpus: CorpusInfo;
  topic: string;
  onTopicChange: (topic: string) => void;
}) {
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return corpus.topics
      .map((name) => ({
        name,
        documents: corpus.titles.filter(
          (document) =>
            document.topic === name &&
            (needle === "" || document.title.toLowerCase().includes(needle)),
        ),
      }))
      .filter((group) => group.documents.length > 0);
  }, [corpus.topics, corpus.titles, query]);

  const matchCount = grouped.reduce((sum, group) => sum + group.documents.length, 0);

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4">
        <span
          className="brand-mark flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[13px] font-bold shadow-sm"
          aria-hidden
        >
          {"{ }"}
        </span>
        <div className="min-w-0">
          <h1
            className="truncate text-[15px] font-semibold tracking-tight"
            style={{ color: "var(--ink-1)" }}
          >
            CS Tutor
          </h1>
          <p className="truncate text-[11px]" style={{ color: "var(--ink-3)" }}>
            {corpus.documents} documents · {corpus.chunks} passages
          </p>
        </div>
      </div>

      {/* Scope + search */}
      <div className="grid gap-2 px-4 pb-3">
        <select
          value={topic}
          onChange={(event) => onTopicChange(event.target.value)}
          className="w-full cursor-pointer rounded-[var(--radius-sm)] border px-2.5 py-2 text-[12.5px] font-medium transition-colors"
          style={{
            borderColor: topic ? "var(--accent)" : "var(--border-2)",
            background: topic ? "var(--accent-soft)" : "var(--surface-1)",
            color: topic ? "var(--accent)" : "var(--ink-1)",
          }}
          aria-label="Restrict retrieval to a topic"
        >
          <option value="">All topics</option>
          {corpus.topics.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <div className="relative">
          <span
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
            style={{ color: "var(--ink-3)" }}
            aria-hidden
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
              <circle cx={9} cy={9} r={5.25} stroke="currentColor" strokeWidth={1.7} />
              <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
            </svg>
          </span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter documents"
            className="w-full rounded-[var(--radius-sm)] border py-2 pl-8 pr-2.5 text-[12.5px] outline-none transition-colors placeholder:opacity-60"
            style={{
              borderColor: "var(--border-1)",
              background: "var(--surface-2)",
              color: "var(--ink-1)",
            }}
            aria-label="Filter documents by title"
          />
        </div>
      </div>

      {/* Document list */}
      <nav className="scroll-area flex-1 overflow-y-auto px-2 pb-4" aria-label="Knowledge base">
        {matchCount === 0 ? (
          <p className="px-2 py-6 text-center text-[12.5px]" style={{ color: "var(--ink-3)" }}>
            No documents match “{query}”.
          </p>
        ) : (
          grouped.map((group) => (
            <div key={group.name} className="mb-3">
              <h2
                className="px-2 pb-1.5 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.07em]"
                style={{ color: "var(--ink-3)" }}
              >
                {group.name}
              </h2>
              <ul className="grid gap-px">
                {group.documents.map((document) => (
                  <li key={document.id}>
                    {/*
                      Clicking scopes retrieval to this document's topic — the
                      list is a control, not just a manifest.
                    */}
                    <button
                      type="button"
                      onClick={() =>
                        onTopicChange(topic === document.topic ? "" : document.topic)
                      }
                      className="group flex w-full items-start gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left transition-colors hover:bg-[var(--surface-2)]"
                      title={`Scope retrieval to ${document.topic}`}
                    >
                      <span
                        className="mt-[7px] h-1 w-1 shrink-0 rounded-full transition-colors"
                        style={{
                          background:
                            topic === document.topic ? "var(--accent)" : "var(--border-2)",
                        }}
                        aria-hidden
                      />
                      <span
                        className="text-[12.5px] leading-snug"
                        style={{ color: "var(--ink-2)" }}
                      >
                        {document.title}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </nav>
    </div>
  );
}

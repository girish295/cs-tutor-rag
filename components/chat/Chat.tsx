"use client";

/**
 * The chat shell: transcript, composer, sidebar and error handling.
 */

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { Composer, type Attachment } from "@/components/chat/Composer";
import { MessagePart } from "@/components/chat/MessageParts";
import { Sidebar, type CorpusInfo } from "@/components/chat/Sidebar";
import { ThemeToggle } from "@/components/chat/ThemeToggle";
import type { ChatMessage } from "@/lib/chat-types";

const SUGGESTIONS: {
  label: string;
  prompt: string;
  hint: string;
  icon: ReactNode;
}[] = [
  {
    label: "Explain a concept",
    prompt: "Why is quicksort O(n^2) in the worst case, and how is it avoided?",
    hint: "retrieves and cites the notes",
    icon: (
      <path
        d="M4 5.5A1.5 1.5 0 015.5 4H9v12H5.5A1.5 1.5 0 014 14.5v-9zM16 5.5A1.5 1.5 0 0014.5 4H11v12h3.5a1.5 1.5 0 001.5-1.5v-9z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    ),
  },
  {
    label: "Test yourself",
    prompt: "Quiz me on hash tables and complexity.",
    hint: "renders an interactive quiz",
    icon: (
      <>
        <circle cx={10} cy={10} r={6.75} stroke="currentColor" strokeWidth={1.5} />
        <path
          d="M7.75 8a2.25 2.25 0 113.75 1.7c-.6.48-1 .8-1 1.55M10.5 13.6h.01"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </>
    ),
  },
  {
    label: "Debug a gotcha",
    prompt: "Why did my LEFT JOIN behave like an INNER JOIN?",
    hint: "a classic SQL trap",
    icon: (
      <>
        <ellipse cx={10} cy={4.75} rx={6} ry={2.25} stroke="currentColor" strokeWidth={1.5} />
        <path
          d="M4 4.75v10.5c0 1.24 2.69 2.25 6 2.25s6-1.01 6-2.25V4.75M4 10c0 1.24 2.69 2.25 6 2.25s6-1.01 6-2.25"
          stroke="currentColor"
          strokeWidth={1.5}
        />
      </>
    ),
  },
  {
    label: "Understand a trap",
    prompt: "Explain the mutable default argument bug in Python.",
    hint: "the bug beginners never spot",
    icon: (
      <path
        d="M7.5 6.5L4 10l3.5 3.5M12.5 6.5L16 10l-3.5 3.5"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
];

export function Chat({ corpus }: { corpus: CorpusInfo }) {
  const [topic, setTopic] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedToBottom = useRef(true);

  const { messages, sendMessage, status, stop, error, clearError, setMessages, regenerate } =
    useChat<ChatMessage>({
      transport: new DefaultChatTransport({ api: "/api/chat" }),
    });

  const busy = status === "submitted" || status === "streaming";

  // Track whether the user is reading history; if so, do not yank them back
  // down as new tokens arrive.
  const handleScroll = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    pinnedToBottom.current = distance < 120;
  }, []);

  useEffect(() => {
    if (!pinnedToBottom.current) return;
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages]);

  const send = (text: string, attachments: Attachment[]) => {
    pinnedToBottom.current = true;
    void sendMessage(
      {
        text: text || "What can you tell me about this?",
        files: attachments.map((attachment) => ({
          type: "file" as const,
          mediaType: attachment.mediaType,
          url: attachment.url,
          filename: attachment.filename,
        })),
      },
      // The topic filter is passed per call rather than baked into the
      // transport, so changing it takes effect on the very next message.
      topic ? { body: { topic } } : undefined,
    );
  };

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* --- Sidebar: a fixed rail on desktop, a drawer on mobile ----------- */}
      <aside
        className="hidden w-[17rem] shrink-0 border-r lg:block"
        style={{ borderColor: "var(--border-1)", background: "var(--surface-1)" }}
      >
        <Sidebar corpus={corpus} topic={topic} onTopicChange={setTopic} />
      </aside>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="absolute inset-0 backdrop-blur-[2px]"
            style={{ background: "rgb(0 0 0 / 45%)" }}
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
          <aside
            className="animate-in relative w-[85vw] max-w-xs border-r"
            style={{ borderColor: "var(--border-1)", background: "var(--surface-1)" }}
          >
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="absolute right-3 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-lg"
              style={{ background: "var(--surface-3)", color: "var(--ink-1)" }}
              aria-label="Close panel"
            >
              ×
            </button>
            <Sidebar corpus={corpus} topic={topic} onTopicChange={setTopic} />
          </aside>
        </div>
      ) : null}

      {/* --- Main column --------------------------------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:px-5"
          style={{
            borderColor: "var(--border-1)",
            background: "color-mix(in oklab, var(--surface-0) 82%, transparent)",
            backdropFilter: "blur(8px)",
          }}
        >
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-2)] lg:hidden"
            style={{ color: "var(--ink-1)" }}
            aria-label="Open knowledge base"
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]" aria-hidden>
              <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
            </svg>
          </button>

          <div className="min-w-0 flex-1">
            <h2
              className="truncate text-[14px] font-semibold tracking-tight"
              style={{ color: "var(--ink-1)" }}
            >
              CS &amp; Programming Tutor
            </h2>
            {topic ? (
              <p className="truncate text-[11px]" style={{ color: "var(--accent)" }}>
                scoped to {topic}
              </p>
            ) : null}
          </div>

          {messages.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                clearError();
              }}
              className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium transition-colors hover:bg-[var(--surface-2)]"
              style={{ borderColor: "var(--border-2)", color: "var(--ink-2)" }}
            >
              <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden>
                <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
              </svg>
              New chat
            </button>
          ) : null}

          <ThemeToggle />
        </header>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="scroll-area flex-1 overflow-y-auto"
        >
          <div
            className={
              messages.length === 0
                ? "mx-auto flex min-h-full w-full max-w-3xl items-center px-4 py-8"
                : "mx-auto w-full max-w-3xl px-4 py-6"
            }
          >
            {messages.length === 0 ? (
              <EmptyState onPick={(prompt) => send(prompt, [])} />
            ) : (
              <ol className="grid gap-6">
                {messages.map((message) => (
                  <li key={message.id} className="animate-in">
                    {message.role === "user" ? (
                      <div className="flex justify-end">
                        <div
                          className="max-w-[85%] rounded-[var(--radius)] rounded-br-md px-4 py-2.5 shadow-sm"
                          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
                        >
                          {message.parts.map((part, index) =>
                            part.type === "text" ? (
                              <p
                                key={index}
                                className="whitespace-pre-wrap text-[15px] leading-relaxed"
                              >
                                {part.text}
                              </p>
                            ) : part.type === "file" &&
                              part.mediaType?.startsWith("image/") ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                key={index}
                                src={part.url}
                                alt="Attached image"
                                className="mt-2 max-h-60 w-auto rounded-lg"
                              />
                            ) : null,
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <span
                          className="brand-mark mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold"
                          aria-hidden
                        >
                          {"{ }"}
                        </span>
                        <div className="min-w-0 flex-1">
                          {message.parts.map((part, index) => (
                            <MessagePart key={index} part={part} />
                          ))}
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}

            {/* Thinking indicator, shown only before the first token arrives. */}
            {status === "submitted" ? (
              <div className="mt-6 flex items-center gap-3">
                <span
                  className="brand-mark flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold"
                  aria-hidden
                >
                  {"{ }"}
                </span>
                <span className="flex gap-1" aria-label="Thinking">
                  {[0, 1, 2].map((index) => (
                    <span
                      key={index}
                      className="typing-dot h-1.5 w-1.5 rounded-full"
                      style={{ background: "var(--ink-3)", animationDelay: `${index * 0.16}s` }}
                    />
                  ))}
                </span>
              </div>
            ) : null}

            {error ? (
              <div
                className="animate-in mt-6 rounded-[var(--radius)] border px-4 py-3"
                style={{ borderColor: "var(--bad)", background: "var(--bad-soft)" }}
                role="alert"
              >
                <p className="text-[13.5px] font-medium" style={{ color: "var(--bad)" }}>
                  {error.message || "Something went wrong."}
                </p>
                <div className="mt-2.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      clearError();
                      void regenerate();
                    }}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                    style={{ background: "var(--bad)", color: "#fff" }}
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    onClick={clearError}
                    className="rounded-lg border px-3 py-1.5 text-xs font-medium"
                    style={{ borderColor: "var(--bad)", color: "var(--bad)" }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 px-3 pb-4 sm:px-5">
          <div className="mx-auto w-full max-w-3xl">
            <Composer onSend={send} onStop={stop} busy={busy} />
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="w-full">
      <span
        className="brand-mark mb-5 flex h-12 w-12 items-center justify-center rounded-2xl text-base font-bold shadow-lg"
        style={{ boxShadow: "0 8px 24px var(--accent-glow)" }}
        aria-hidden
      >
        {"{ }"}
      </span>

      <h3
        className="text-[28px] font-semibold leading-tight tracking-tight sm:text-[32px]"
        style={{ color: "var(--ink-1)" }}
      >
        What would you like to understand?
      </h3>
      <p
        className="mt-2.5 max-w-xl text-[15px] leading-relaxed"
        style={{ color: "var(--ink-2)" }}
      >
        Ask about algorithms, data structures, complexity, Python, JavaScript, OOP, SQL
        or Git. Every answer is retrieved from a curated set of course notes and cited,
        so you can check it. You can also attach a photo of a problem or a code
        screenshot.
      </p>

      <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion.prompt}
            type="button"
            onClick={() => onPick(suggestion.prompt)}
            className="card card-lit group relative overflow-hidden px-3.5 py-3 text-left transition-all duration-200 hover:-translate-y-0.5"
            style={{ boxShadow: "var(--shadow-1)" }}
            onMouseEnter={(event) => {
              event.currentTarget.style.borderColor = "var(--accent)";
              event.currentTarget.style.boxShadow = "var(--shadow-2)";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.borderColor = "var(--border-1)";
              event.currentTarget.style.boxShadow = "var(--shadow-1)";
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                aria-hidden
              >
                <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
                  {suggestion.icon}
                </svg>
              </span>
              <span
                className="text-[10.5px] font-semibold uppercase tracking-[0.07em]"
                style={{ color: "var(--ink-3)" }}
              >
                {suggestion.label}
              </span>
              <span
                className="ml-auto translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
                style={{ color: "var(--accent)" }}
                aria-hidden
              >
                <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
                  <path
                    d="M5 10h10M11 6l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth={1.7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </div>
            <p
              className="mt-2 text-[14px] font-medium leading-snug"
              style={{ color: "var(--ink-1)" }}
            >
              {suggestion.prompt}
            </p>
            <p className="mt-1 text-[11.5px]" style={{ color: "var(--ink-3)" }}>
              {suggestion.hint}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

"use client";

/**
 * Maps message parts onto components — the heart of the generative UI.
 *
 * A tool part arrives as `tool-<name>` and moves through states
 * (`input-streaming` → `input-available` → `output-available`). Each tool gets a
 * pending placeholder while it runs and its own component once output lands, so
 * the transcript is a mix of prose and live widgets rather than JSON blobs.
 */

import { QuizCard, type QuizPayload } from "@/components/tools/QuizCard";
import { RetrievalPanel, type RetrievalPayload } from "@/components/tools/RetrievalPanel";
import { ErrorNote, ToolPending } from "@/components/ui/primitives";
import { Markdown } from "@/components/chat/Markdown";
import type { ChatMessage } from "@/lib/chat-types";

const PENDING_LABELS: Record<string, string> = {
  "tool-searchKnowledgeBase": "Searching the knowledge base",
  "tool-generateQuiz": "Building your quiz",
};

type Part = ChatMessage["parts"][number];

export function MessagePart({ part }: { part: Part }) {
  // --- Plain content ------------------------------------------------------
  if (part.type === "text") {
    return <Markdown content={part.text} />;
  }

  if (part.type === "file" && part.mediaType?.startsWith("image/")) {
    // The src is a data: URL from the user's own upload, which next/image
    // cannot optimise — it would only add a round trip.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={part.url}
        alt="Attached image"
        className="my-2 max-h-72 w-auto rounded-[var(--radius)] border object-contain"
        style={{ borderColor: "var(--border-1)" }}
      />
    );
  }

  // --- Tool parts ---------------------------------------------------------
  if (!part.type.startsWith("tool-")) return null;

  const state = (part as { state?: string }).state;

  if (state === "input-streaming" || state === "input-available") {
    return <ToolPending label={PENDING_LABELS[part.type] ?? "Working"} />;
  }

  if (state === "output-error") {
    const errorText = (part as { errorText?: string }).errorText;
    return <ErrorNote>{errorText ?? "That tool call failed."}</ErrorNote>;
  }

  if (state !== "output-available") return null;

  const output = (part as { output?: unknown }).output;
  if (!output || typeof output !== "object") return null;

  switch (part.type) {
    case "tool-searchKnowledgeBase":
      return <RetrievalPanel data={output as RetrievalPayload} />;
    case "tool-generateQuiz":
      return <QuizCard data={output as QuizPayload} />;
    default:
      return null;
  }
}

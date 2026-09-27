/**
 * Demo mode: a scripted UI message stream served when no `GROQ_API_KEY` is set.
 *
 * This is not a mock of the whole app. Retrieval is real, and the chunks emitted
 * are the same protocol `streamText` produces — so the chat UI, the retrieval
 * inspector and the quiz widget are exercised exactly as they are in live mode.
 *
 * What is *not* real is the prose: instead of a model-written answer, the text is
 * assembled extractively from the retrieved passages, and it says so. The point
 * is that a reviewer can clone the repo and see the whole system work without
 * first obtaining an API key.
 */

import { createUIMessageStream, type UIMessageChunk } from "ai";

import { retrieve, toCitations, tokenizeQuery } from "@/lib/rag";

type Writer = { write: (chunk: UIMessageChunk) => void };

/** Streams a string as several deltas so the UI's streaming path is exercised. */
async function streamText(writer: Writer, id: string, text: string): Promise<void> {
  writer.write({ type: "text-start", id });
  const pieces = text.match(/\S+\s*/g) ?? [text];
  let buffer = "";
  for (const piece of pieces) {
    buffer += piece;
    if (buffer.length >= 18) {
      writer.write({ type: "text-delta", id, delta: buffer });
      buffer = "";
      await new Promise((resolve) => setTimeout(resolve, 12));
    }
  }
  if (buffer) writer.write({ type: "text-delta", id, delta: buffer });
  writer.write({ type: "text-end", id });
}

/** Emits the three chunks that make up one complete tool invocation. */
function writeToolCall(
  writer: Writer,
  toolName: string,
  toolCallId: string,
  input: unknown,
  output: unknown,
): void {
  writer.write({ type: "tool-input-start", toolCallId, toolName });
  writer.write({ type: "tool-input-available", toolCallId, toolName, input });
  writer.write({ type: "tool-output-available", toolCallId, output });
}

function wantsQuiz(text: string): boolean {
  return /\b(quiz|test me|mcq|practice question|multiple choice|assess)\b/i.test(text);
}

/**
 * Hand-authored quiz for demo mode. In live mode the model generates questions
 * from retrieved passages instead; demo mode cannot write questions, so this is
 * clearly labelled a sample.
 */
const SAMPLE_QUIZ = {
  title: "Complexity & Data Structures (sample)",
  topic: "Algorithms",
  difficulty: "beginner",
  questions: [
    {
      question: "What is the average-case time complexity of a hash table lookup?",
      options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
      correctIndex: 0,
      explanation:
        "Computing the hash and indexing the bucket array are both constant-time. The worst case is O(n), when every key collides into one bucket.",
    },
    {
      question: "Why is appending to a dynamic array O(1) amortised rather than O(1)?",
      options: [
        "Because the array is re-sorted after each append",
        "Because a full buffer must be reallocated and copied, which is O(n)",
        "Because appending requires a hash computation",
        "Because every element shifts one position right",
      ],
      correctIndex: 1,
      explanation:
        "Most appends are constant-time, but when the backing buffer fills it doubles and copies everything. Doubling makes those copies rare enough that the average cost per append is constant.",
    },
    {
      question: "Which traversal of a binary search tree yields keys in sorted order?",
      options: ["Pre-order", "In-order", "Post-order", "Level-order"],
      correctIndex: 1,
      explanation:
        "In-order visits left subtree, then node, then right subtree. Combined with the BST invariant that left keys are smaller, that produces ascending order.",
    },
    {
      question: "Quicksort's worst case is O(n^2). When does it occur?",
      options: [
        "When the array contains duplicate values",
        "When the pivot is always the smallest or largest element",
        "When the array is already sorted, always",
        "When recursion depth exceeds log n",
      ],
      correctIndex: 1,
      explanation:
        "A maximally lopsided partition reduces the problem by only one element per level, giving n levels of O(n) work. A naive first-element pivot on sorted input causes exactly this, which is why random or median-of-three pivots are used.",
    },
    {
      question: "Which operation is a hash table unable to do efficiently?",
      options: [
        "Look up a key",
        "Insert a key",
        "Return all keys between 10 and 50",
        "Delete a key",
      ],
      correctIndex: 2,
      explanation:
        "Hashing destroys ordering, so a range query needs a full O(n) scan. A balanced BST gives O(log n) lookup but keeps keys ordered — that is the trade-off.",
    },
  ],
};

export interface DemoStreamOptions {
  userText: string;
  imageCount: number;
  topic?: string;
}

export function createDemoStream(options: DemoStreamOptions) {
  const { userText, imageCount, topic } = options;

  return createUIMessageStream({
    onError: (error) =>
      `Demo stream failed: ${error instanceof Error ? error.message : String(error)}`,
    execute: async ({ writer }) => {
      writer.write({ type: "start" });
      writer.write({ type: "start-step" });

      const query = userText.trim() || "computer science fundamentals";

      // --- Real retrieval, surfaced as a real tool call ---------------------
      const retrieval = await retrieve(query, { topK: 5, topic, diversity: 0.65 });
      const citations = toCitations(retrieval.results, tokenizeQuery(query));

      writeToolCall(
        writer,
        "searchKnowledgeBase",
        "demo-kb-1",
        { query, ...(topic ? { topic } : {}) },
        {
          query,
          found: citations.length,
          retrieversUsed: retrieval.retrieversUsed,
          timingMs: retrieval.timingMs,
          citations: citations.map((citation, index) => ({
            ...citation,
            label: `[${index + 1}]`,
            text: retrieval.results[index].chunk.text,
          })),
        },
      );

      // --- Extractive answer ------------------------------------------------
      const parts: string[] = [
        "> **Demo mode.** No `GROQ_API_KEY` is set, so there is no model writing this " +
          "reply. The retrieval above and the widgets below are real — only the prose is " +
          "assembled directly from the retrieved passages. Add a key for a real tutored answer.\n\n",
      ];

      if (imageCount > 0) {
        parts.push(
          `**Image received** (${imageCount} attached, shown with your message). Reading ` +
            "images needs a vision model, so set `GROQ_API_KEY` to have the attachment " +
            "actually analysed — the upload and request plumbing you just exercised is real.\n\n",
        );
      }

      if (citations.length === 0) {
        parts.push(
          `Nothing in the knowledge base matched **"${query}"**. The notes cover algorithms, ` +
            "data structures, complexity, Python, JavaScript, OOP, SQL and Git — try a " +
            "question in one of those areas, or open the panel to see every document.\n",
        );
      } else {
        const documentCount = new Set(citations.map((c) => c.docId)).size;
        parts.push(
          `Here is what the course notes say, drawn from ${documentCount} document` +
            `${documentCount === 1 ? "" : "s"} in ${retrieval.timingMs}ms:\n\n`,
        );
        citations.forEach((citation, index) => {
          parts.push(
            `**[${index + 1}] ${citation.docTitle} — ${citation.heading}**\n${citation.snippet}\n\n`,
          );
        });
      }

      await streamText(writer, "demo-text-1", parts.join(""));

      // --- Quiz widget, on request -----------------------------------------
      if (wantsQuiz(userText)) {
        writeToolCall(
          writer,
          "generateQuiz",
          "demo-quiz-1",
          { title: SAMPLE_QUIZ.title, topic: SAMPLE_QUIZ.topic },
          { ...SAMPLE_QUIZ, questionCount: SAMPLE_QUIZ.questions.length },
        );
      } else {
        await streamText(
          writer,
          "demo-text-2",
          "\n---\n\nTry `quiz me on complexity` to see the interactive quiz widget.\n",
        );
      }

      writer.write({ type: "finish-step" });
      writer.write({ type: "finish" });
    },
  });
}

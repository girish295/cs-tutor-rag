/**
 * RAG exposed as a tool ("agentic retrieval").
 *
 * Retrieval could be done unconditionally before every model call, and many RAG
 * tutorials do exactly that. Making it a tool instead means the model decides
 * when it needs the knowledge base and what to search for — so "hi" costs no
 * retrieval, a follow-up question can re-search with better terms, and a
 * multi-part question can issue several targeted searches in one turn. It also
 * makes the retrieval step visible in the transcript, which is what the
 * Retrieval Inspector in the UI renders.
 */

import { tool } from "ai";
import { z } from "zod";

import { corpusStats, retrieve, toCitations, tokenizeQuery } from "@/lib/rag";

export const searchKnowledgeBase = tool({
  description:
    "Search the CS & programming knowledge base for authoritative course notes. " +
    "Use this for any question about algorithms, data structures, complexity, " +
    "Python, JavaScript, OOP, SQL or Git. Prefer it over your own memory, and " +
    "cite the sources it returns. You may call it more than once with different " +
    "queries for a multi-part question.",
  inputSchema: z.object({
    query: z
      .string()
      .min(2)
      .max(300)
      .describe(
        "The search query. Use the technical vocabulary of the topic, not the " +
          "user's exact wording, and keep it focused on a single concept.",
      ),
    topic: z
      .string()
      .optional()
      .describe(
        "Optional topic filter. Only use a value returned by a previous call: " +
          "Algorithms, Data Structures, Programming Languages, Software Design, " +
          "Databases, or Tools and Workflow.",
      ),
    expansions: z
      .array(z.string().min(2).max(200))
      .max(3)
      .optional()
      .describe(
        "Optional alternative phrasings of the same question, used to widen " +
          "recall when the user's wording may not match the notes.",
      ),
  }),
  execute: async ({ query, topic, expansions }) => {
    const result = await retrieve(query, {
      topK: 5,
      topic,
      expansions,
      diversity: 0.65,
    });

    const citations = toCitations(result.results, tokenizeQuery(query));

    if (citations.length === 0) {
      return {
        query,
        found: 0,
        citations: [],
        retrieversUsed: result.retrieversUsed,
        timingMs: result.timingMs,
        availableTopics: corpusStats().topics,
        note:
          "No passages matched. Say so plainly rather than inventing an answer. " +
          "You may then answer from general knowledge, but state clearly that it " +
          "is not from the course notes.",
      };
    }

    return {
      query,
      found: citations.length,
      retrieversUsed: result.retrieversUsed,
      timingMs: result.timingMs,
      /**
       * `snippet` is what the model should quote and cite. The full chunk text
       * is included too, because a snippet alone is often not enough to answer
       * from, and the model needs the surrounding explanation.
       */
      citations: citations.map((citation, index) => ({
        ...citation,
        label: `[${index + 1}]`,
        text: result.results[index].chunk.text,
      })),
      instruction:
        "Answer using these passages. Cite them inline as [1], [2] matching the " +
        "labels above. If they do not fully cover the question, say which part " +
        "is not covered.",
    };
  },
});

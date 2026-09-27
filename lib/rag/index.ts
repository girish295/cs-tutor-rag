/**
 * The retrieval entry point: corpus loading, index construction and querying.
 *
 * Retrieval is lexical (BM25F) with query expansion, rank fusion and
 * diversification. There is no embedding provider and no vector database, which
 * is a deliberate choice rather than a missing feature:
 *
 *  - Groq exposes no embeddings endpoint, so dense retrieval would require a
 *    second API key and break the "works with no setup" property this project
 *    depends on.
 *  - The corpus is CS course notes, where questions are dense with exact
 *    technical terms ("amortised", "LEFT JOIN", "tail call"). Exact term
 *    matching is genuinely strong on this kind of text.
 *  - Query expansion recovers most of what embeddings would buy: a student
 *    asking about "dicts" or "bfs" still reaches "hash table" and "breadth
 *    first search" (see `tokenize.ts`).
 *
 * The index is built once per process and cached in module scope, so on Vercel
 * it costs a few milliseconds per cold start.
 */

import { Bm25Index } from "./bm25";
import { CORPUS_FILES } from "./corpus.generated";
import { chunkDoc, parseDoc } from "./chunk";
import { diversify, reciprocalRankFusion, type RankedList } from "./fuse";
import { tokenizeQuery } from "./tokenize";
import type {
  Chunk,
  Citation,
  CorpusDoc,
  RetrieveOptions,
  RetrieveResult,
  ScoredChunk,
} from "./types";

let corpusCache: CorpusDoc[] | null = null;

/**
 * Parses the bundled knowledge base.
 *
 * The markdown is compiled into `corpus.generated.ts` by
 * `scripts/build-corpus.mjs`, so there is no filesystem access at runtime and
 * the notes behave identically in dev, tests and a serverless function.
 */
export function loadCorpus(): CorpusDoc[] {
  if (corpusCache) return corpusCache;
  if (CORPUS_FILES.length === 0) {
    throw new Error(
      "knowledge base is empty — run `npm run corpus` to regenerate it from lib/rag/corpus/",
    );
  }
  corpusCache = CORPUS_FILES.map((file) => parseDoc(file.filename, file.raw));
  return corpusCache;
}

interface BuiltIndex {
  chunks: Chunk[];
  bm25: Bm25Index;
  docs: CorpusDoc[];
}

let indexCache: BuiltIndex | null = null;

export function getIndex(): BuiltIndex {
  if (indexCache) return indexCache;
  const docs = loadCorpus();
  const chunks = docs.flatMap((doc) => chunkDoc(doc));
  indexCache = { chunks, bm25: new Bm25Index(chunks), docs };
  return indexCache;
}

/**
 * Extracts a short snippet centred on the densest cluster of query terms, so a
 * citation shows the sentence that actually matched rather than the first line
 * of the chunk.
 */
/**
 * Flattens markdown into readable single-line prose for a snippet.
 *
 * Naively collapsing whitespace turns a markdown table into a run of pipes
 * ("| Operation | Complexity |---|---|"), which looks broken in the UI. Table
 * separator rows are dropped and remaining cells joined with a middle dot, and
 * code fence markers are removed.
 */
function flattenMarkdown(markdown: string): string {
  return markdown
    .split(/\r?\n/)
    .filter((line) => !(line.includes("|") && /^[\s|:\-]+$/.test(line)))
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("|")) return line;
      return trimmed
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean)
        .join(" · ");
    })
    .join("\n")
    .replace(/^\s*```[a-z]*\s*$/gim, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildSnippet(
  chunk: Chunk,
  queryTerms: string[],
  maxLength = 260,
): string {
  const text = flattenMarkdown(chunk.text);
  if (text.length <= maxLength) return text;
  if (queryTerms.length === 0) return `${text.slice(0, maxLength).trim()}…`;

  const lowered = text.toLowerCase();
  let bestStart = 0;
  let bestHits = -1;

  // Slide a window in modest steps; exact placement is not important.
  for (let start = 0; start < text.length; start += 40) {
    const window = lowered.slice(start, start + maxLength);
    let hits = 0;
    for (const term of queryTerms) {
      if (term.length > 2 && window.includes(term)) hits++;
    }
    if (hits > bestHits) {
      bestHits = hits;
      bestStart = start;
    }
  }

  // Avoid cutting mid-word at the left edge.
  let start = bestStart;
  if (start > 0) {
    const space = text.indexOf(" ", start);
    if (space !== -1 && space - start < 20) start = space + 1;
  }
  const slice = text.slice(start, start + maxLength).trim();
  return `${start > 0 ? "…" : ""}${slice}${start + maxLength < text.length ? "…" : ""}`;
}

/** Converts fused results into the citation shape used by the model and UI. */
export function toCitations(
  results: ScoredChunk[],
  queryTerms: string[],
): Citation[] {
  return results.map((result) => ({
    id: result.chunk.id,
    docId: result.chunk.docId,
    docTitle: result.chunk.docTitle,
    heading: result.chunk.heading,
    topic: result.chunk.topic,
    snippet: buildSnippet(result.chunk, queryTerms),
    score: Number(result.score.toFixed(5)),
  }));
}

/**
 * Retrieves passages for a query.
 *
 * The original query and any expansions are each searched separately, then the
 * resulting ranked lists are fused with RRF and diversified across documents.
 */
export async function retrieve(
  query: string,
  options: RetrieveOptions = {},
): Promise<RetrieveResult> {
  const startedAt = Date.now();
  const topK = options.topK ?? 5;
  const candidates = options.candidatesPerRetriever ?? 20;
  const diversity = options.diversity ?? 0.7;
  const expansions = (options.expansions ?? [])
    .map((item) => item.trim())
    .filter(
      (item) =>
        item.length > 0 && item.toLowerCase() !== query.trim().toLowerCase(),
    )
    .slice(0, 3);

  const { bm25 } = getIndex();
  const formulations = [query, ...expansions];
  const lists: RankedList[] = [];

  for (const [position, formulation] of formulations.entries()) {
    const terms = tokenizeQuery(formulation);
    const results = bm25.search(terms, candidates);
    if (results.length === 0) continue;
    lists.push({
      retriever: "bm25",
      // The original query is trusted more than a generated rewrite.
      weight: position === 0 ? 1 : 0.6,
      results,
    });
  }

  const fused = reciprocalRankFusion(lists);

  // Topic filtering is applied post-fusion so that scores stay comparable to an
  // unfiltered run, which makes the filter's effect visible in the UI.
  const filtered = options.topic
    ? fused.filter(
        (item) =>
          item.chunk.topic.toLowerCase() === options.topic!.toLowerCase(),
      )
    : fused;

  return {
    query,
    expansions,
    results: diversify(filtered, topK, diversity),
    retrieversUsed: lists.length > 0 ? ["bm25"] : [],
    timingMs: Date.now() - startedAt,
  };
}

/** Corpus statistics, used by the health endpoint and the UI sidebar. */
export function corpusStats() {
  const { docs, chunks } = getIndex();
  const topics = [...new Set(docs.map((doc) => doc.topic))].sort();
  return {
    documents: docs.length,
    chunks: chunks.length,
    topics,
    averageChunkTokens:
      chunks.length > 0
        ? Math.round(
            chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0) /
              chunks.length,
          )
        : 0,
    titles: docs.map((doc) => ({
      id: doc.id,
      title: doc.title,
      topic: doc.topic,
      difficulty: doc.difficulty,
    })),
  };
}

/** Test seam: clears module-level caches. */
export function resetCachesForTesting(): void {
  corpusCache = null;
  indexCache = null;
}

export { tokenizeQuery } from "./tokenize";
export type {
  Chunk,
  Citation,
  CorpusDoc,
  RetrieveResult,
  ScoredChunk,
} from "./types";

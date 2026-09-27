/**
 * Shared types for the retrieval layer.
 *
 * The retrieval pipeline is deliberately provider-agnostic: nothing in this
 * directory imports the AI SDK or Groq. That keeps it unit-testable without an
 * API key, which is also what makes the app's demo mode possible.
 */

/** A markdown document in the knowledge base, after frontmatter parsing. */
export interface CorpusDoc {
  id: string;
  title: string;
  topic: string;
  tags: string[];
  difficulty: string;
  /** Markdown body with the frontmatter block stripped. */
  body: string;
}

/** A retrievable unit of text. Chunks, not whole documents, are indexed. */
export interface Chunk {
  /** Stable id of the form `${docId}#${ordinal}`. */
  id: string;
  docId: string;
  docTitle: string;
  topic: string;
  tags: string[];
  difficulty: string;
  /** The nearest `##` heading above this chunk, used for citations. */
  heading: string;
  text: string;
  /** Token count after tokenisation, cached to avoid recomputing. */
  tokenCount: number;
}

export type RetrieverName = "bm25";

/** A chunk paired with the score and provenance of why it was retrieved. */
export interface ScoredChunk {
  chunk: Chunk;
  /** Final fused score. Not comparable across queries. */
  score: number;
  /** Diagnostics, surfaced in the UI to make retrieval legible. */
  signals: {
    bm25?: number;
    /** 1-based rank from each ranked list that contributed. */
    ranks: Partial<Record<RetrieverName, number>>;
  };
}

/** A citation as exposed to the model and rendered in the UI. */
export interface Citation {
  id: string;
  docId: string;
  docTitle: string;
  heading: string;
  topic: string;
  snippet: string;
  score: number;
}

export interface RetrieveOptions {
  /** Number of chunks to return after fusion and diversification. */
  topK?: number;
  /** How many candidates each query formulation contributes before fusion. */
  candidatesPerRetriever?: number;
  /** Restrict to documents whose topic matches (case-insensitive). */
  topic?: string;
  /**
   * Extra query formulations fused alongside the original query. Improves
   * recall when the user's wording differs from the corpus wording.
   */
  expansions?: string[];
  /**
   * 0 disables diversification, 1 maximises relevance. Prevents all results
   * coming from a single document.
   */
  diversity?: number;
}

export interface RetrieveResult {
  query: string;
  expansions: string[];
  results: ScoredChunk[];
  retrieversUsed: RetrieverName[];
  timingMs: number;
}

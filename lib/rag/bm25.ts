/**
 * BM25 lexical retrieval over the chunked corpus.
 *
 * BM25 is the sparse half of the hybrid retriever. It is the right default for
 * this corpus: CS questions are dense with exact technical terms ("amortised",
 * "LEFT JOIN", "tail call"), and exact term matching beats semantic similarity
 * whenever the user already knows the vocabulary. The dense retriever in
 * `vector.ts` covers the case where they do not.
 */

import type { Chunk } from "./types";
import { termFrequencies, tokenize } from "./tokenize";

export interface Bm25Params {
  /** Term-frequency saturation. Higher means repeated terms keep adding weight. */
  k1?: number;
  /** Length normalisation, 0 to 1. 0.75 is the long-standing default. */
  b?: number;
  /**
   * How many body occurrences one occurrence in the document title, section
   * heading or tags is worth.
   */
  fieldWeight?: number;
}

interface IndexedChunk {
  chunk: Chunk;
  /** Weighted term frequencies across the body and the metadata fields. */
  tf: Map<string, number>;
  length: number;
}

export class Bm25Index {
  private readonly documents: IndexedChunk[] = [];
  /** term -> number of chunks containing it. */
  private readonly documentFrequency = new Map<string, number>();
  private averageLength = 0;
  private readonly k1: number;
  private readonly b: number;
  private readonly fieldWeight: number;

  /**
   * Builds a BM25F-style index treating each chunk as two fields: its body, and
   * its metadata (document title, section heading, tags).
   *
   * Metadata terms are folded into the term-frequency map with extra weight
   * rather than applied as a multiplier on the body score. The distinction is
   * not cosmetic: a multiplier scales the body's contribution, so a term that
   * appears *only* in the heading has a body frequency of zero and would score
   * zero no matter how large the multiplier. Folding it in makes headings
   * genuinely searchable, which is what lets a query for "the two-pointer
   * technique" find a section whose body never repeats the word "technique".
   */
  constructor(chunks: Chunk[], params: Bm25Params = {}) {
    this.k1 = params.k1 ?? 1.5;
    this.b = params.b ?? 0.75;
    this.fieldWeight = params.fieldWeight ?? 2.5;

    let totalLength = 0;
    for (const chunk of chunks) {
      const bodyTerms = tokenize(chunk.text);
      const metadataTerms = tokenize(
        `${chunk.docTitle} ${chunk.heading} ${chunk.tags.join(" ")}`,
      );

      const tf = termFrequencies(bodyTerms);
      for (const [term, count] of termFrequencies(metadataTerms)) {
        tf.set(term, (tf.get(term) ?? 0) + count * this.fieldWeight);
      }

      // Length counts both fields so that normalisation stays consistent with
      // the frequencies actually being scored.
      const length = bodyTerms.length + metadataTerms.length * this.fieldWeight;

      this.documents.push({ chunk, tf, length });
      totalLength += length;
      for (const term of tf.keys()) {
        this.documentFrequency.set(term, (this.documentFrequency.get(term) ?? 0) + 1);
      }
    }
    this.averageLength = chunks.length > 0 ? totalLength / chunks.length : 0;
  }

  get size(): number {
    return this.documents.length;
  }

  /**
   * Inverse document frequency, using the BM25-with-0.5-smoothing form.
   *
   * The `Math.max(..., 1e-9)` floor matters: the raw formula goes negative for
   * terms appearing in more than half the corpus, which would let a common term
   * actively subtract from a chunk's score and push genuinely relevant chunks
   * below irrelevant ones. Clamping to a tiny positive value makes such terms
   * merely uninformative instead.
   */
  private idf(term: string): number {
    const n = this.documents.length;
    const df = this.documentFrequency.get(term) ?? 0;
    if (df === 0) return 0;
    return Math.max(Math.log((n - df + 0.5) / (df + 0.5) + 1), 1e-9);
  }

  /** Scores every chunk against the pre-tokenised query terms. */
  search(queryTerms: string[], limit = 20): { chunk: Chunk; score: number }[] {
    if (queryTerms.length === 0 || this.documents.length === 0) return [];

    const scored: { chunk: Chunk; score: number }[] = [];

    for (const doc of this.documents) {
      let score = 0;
      for (const term of queryTerms) {
        const tf = doc.tf.get(term);
        if (!tf) continue;
        const idf = this.idf(term);
        if (idf === 0) continue;

        const normalisation =
          this.averageLength > 0 ? doc.length / this.averageLength : 1;
        const denominator = tf + this.k1 * (1 - this.b + this.b * normalisation);
        score += (idf * (tf * (this.k1 + 1))) / denominator;
      }
      if (score > 0) scored.push({ chunk: doc.chunk, score });
    }

    scored.sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id));
    return scored.slice(0, limit);
  }
}

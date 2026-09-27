/**
 * Result fusion and diversification.
 */

import type { Chunk, RetrieverName, ScoredChunk } from "./types";

export interface RankedList {
  retriever: RetrieverName;
  /** Weight applied to this list's contribution. */
  weight: number;
  results: { chunk: Chunk; score: number }[];
}

/**
 * Reciprocal Rank Fusion.
 *
 * RRF combines ranked lists using only each item's *rank*, never its raw score.
 * That property is exactly why it is used here: BM25 produces unbounded
 * positive scores while cosine similarity lives in [-1, 1], so the two are not
 * comparable and any attempt to add or average them requires a normalisation
 * step that is itself arbitrary and query-dependent. Ranks sidestep the problem
 * entirely, and RRF is empirically competitive with far more elaborate schemes.
 *
 * The constant `k` (60 is the value from the original paper) damps the
 * influence of the very top ranks, so one retriever ranking something first
 * cannot by itself dominate the fused ordering.
 */
export function reciprocalRankFusion(lists: RankedList[], k = 60): ScoredChunk[] {
  const accumulator = new Map<string, ScoredChunk>();

  for (const list of lists) {
    list.results.forEach((result, index) => {
      const rank = index + 1;
      const contribution = list.weight / (k + rank);
      const existing = accumulator.get(result.chunk.id);

      if (existing) {
        existing.score += contribution;
        existing.signals[list.retriever] = result.score;
        existing.signals.ranks[list.retriever] = rank;
      } else {
        accumulator.set(result.chunk.id, {
          chunk: result.chunk,
          score: contribution,
          signals: {
            [list.retriever]: result.score,
            ranks: { [list.retriever]: rank },
          } as ScoredChunk["signals"],
        });
      }
    });
  }

  return [...accumulator.values()].sort(
    (a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id),
  );
}

/**
 * Greedy diversification in the spirit of Maximal Marginal Relevance.
 *
 * Without this, a query like "explain time complexity" returns five chunks from
 * the same document, and the model receives five restatements of one idea
 * instead of a broad context window. Rather than comparing embeddings (which
 * are optional here), similarity is approximated by *document identity*: each
 * additional chunk from an already-represented document is penalised.
 *
 * `lambda` is the relevance/diversity trade-off — 1 keeps pure relevance order,
 * 0 spreads results across documents as aggressively as possible.
 */
export function diversify(
  ranked: ScoredChunk[],
  topK: number,
  lambda = 0.7,
): ScoredChunk[] {
  if (ranked.length === 0 || topK <= 0) return [];
  if (lambda >= 1) return ranked.slice(0, topK);

  const selected: ScoredChunk[] = [];
  const remaining = [...ranked];
  const perDocumentCount = new Map<string, number>();

  while (selected.length < topK && remaining.length > 0) {
    let bestIndex = 0;
    let bestValue = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const alreadySelected = perDocumentCount.get(candidate.chunk.docId) ?? 0;
      // Each prior chunk from the same document compounds the penalty.
      const penalty = (1 - lambda) * alreadySelected;
      const value = candidate.score * Math.pow(0.5, penalty * 2);
      if (value > bestValue) {
        bestValue = value;
        bestIndex = i;
      }
    }

    const [chosen] = remaining.splice(bestIndex, 1);
    selected.push(chosen);
    perDocumentCount.set(
      chosen.chunk.docId,
      (perDocumentCount.get(chosen.chunk.docId) ?? 0) + 1,
    );
  }

  return selected;
}

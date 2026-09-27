import { describe, expect, it } from "vitest";
import { diversify, reciprocalRankFusion, type RankedList } from "@/lib/rag/fuse";
import type { Chunk, ScoredChunk } from "@/lib/rag/types";

function chunk(id: string, docId = id.split("#")[0]): Chunk {
  return {
    id,
    docId,
    docTitle: docId,
    topic: "Testing",
    tags: [],
    difficulty: "beginner",
    heading: "H",
    text: `text for ${id}`,
    tokenCount: 3,
  };
}

describe("reciprocalRankFusion", () => {
  it("rewards a chunk ranked highly by more than one query formulation", () => {
    const lists: RankedList[] = [
      {
        retriever: "bm25",
        weight: 1,
        // Raw scores are on different scales between formulations, which is why
        // RRF uses ranks rather than trying to normalise scores.
        results: [
          { chunk: chunk("a#0"), score: 18.4 },
          { chunk: chunk("b#0"), score: 12.1 },
        ],
      },
      {
        retriever: "bm25",
        weight: 1,
        results: [
          { chunk: chunk("b#0"), score: 4.2 },
          { chunk: chunk("c#0"), score: 3.1 },
        ],
      },
    ];

    const fused = reciprocalRankFusion(lists);
    // b#0 is the only chunk in both lists, so it must win.
    expect(fused[0].chunk.id).toBe("b#0");
    expect(fused).toHaveLength(3);
  });

  it("records rank and raw score for transparency", () => {
    const fused = reciprocalRankFusion([
      { retriever: "bm25", weight: 1, results: [{ chunk: chunk("a#0"), score: 9 }] },
    ]);
    expect(fused[0].signals.bm25).toBe(9);
    expect(fused[0].signals.ranks.bm25).toBe(1);
  });

  it("applies list weights", () => {
    const fused = reciprocalRankFusion([
      { retriever: "bm25", weight: 1, results: [{ chunk: chunk("a#0"), score: 1 }] },
      { retriever: "bm25", weight: 0.1, results: [{ chunk: chunk("b#0"), score: 1 }] },
    ]);
    expect(fused[0].chunk.id).toBe("a#0");
  });

  it("returns an empty array when given no lists", () => {
    expect(reciprocalRankFusion([])).toEqual([]);
  });

  it("breaks ties deterministically by chunk id", () => {
    const fused = reciprocalRankFusion([
      { retriever: "bm25", weight: 1, results: [{ chunk: chunk("z#0"), score: 1 }] },
      { retriever: "bm25", weight: 1, results: [{ chunk: chunk("a#0"), score: 1 }] },
    ]);
    expect(fused.map((item) => item.chunk.id)).toEqual(["a#0", "z#0"]);
  });
});

describe("diversify", () => {
  const ranked: ScoredChunk[] = [
    { chunk: chunk("doc1#0", "doc1"), score: 0.9, signals: { ranks: {} } },
    { chunk: chunk("doc1#1", "doc1"), score: 0.88, signals: { ranks: {} } },
    { chunk: chunk("doc1#2", "doc1"), score: 0.86, signals: { ranks: {} } },
    { chunk: chunk("doc2#0", "doc2"), score: 0.5, signals: { ranks: {} } },
    { chunk: chunk("doc3#0", "doc3"), score: 0.4, signals: { ranks: {} } },
  ];

  it("spreads results across documents rather than returning one document", () => {
    const selected = diversify(ranked, 3, 0.5);
    expect(new Set(selected.map((item) => item.chunk.docId)).size).toBeGreaterThan(1);
  });

  it("keeps the single most relevant chunk first", () => {
    expect(diversify(ranked, 3, 0.5)[0].chunk.id).toBe("doc1#0");
  });

  it("preserves pure relevance order when lambda is 1", () => {
    expect(diversify(ranked, 3, 1).map((item) => item.chunk.id)).toEqual([
      "doc1#0",
      "doc1#1",
      "doc1#2",
    ]);
  });

  it("respects topK", () => {
    expect(diversify(ranked, 2, 0.7)).toHaveLength(2);
  });

  it("handles topK larger than the input", () => {
    expect(diversify(ranked, 99, 0.7)).toHaveLength(ranked.length);
  });

  it("returns an empty array for empty input or a topK of zero", () => {
    expect(diversify([], 5, 0.7)).toEqual([]);
    expect(diversify(ranked, 0, 0.7)).toEqual([]);
  });

  it("never returns a duplicate chunk", () => {
    const selected = diversify(ranked, 5, 0.3);
    expect(new Set(selected.map((item) => item.chunk.id)).size).toBe(selected.length);
  });
});

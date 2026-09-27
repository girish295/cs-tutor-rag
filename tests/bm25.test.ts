import { describe, expect, it } from "vitest";
import { Bm25Index } from "@/lib/rag/bm25";
import { tokenizeQuery } from "@/lib/rag/tokenize";
import type { Chunk } from "@/lib/rag/types";

function chunk(id: string, heading: string, text: string, docTitle = "Doc"): Chunk {
  return {
    id,
    docId: id.split("#")[0],
    docTitle,
    topic: "Testing",
    tags: [],
    difficulty: "beginner",
    heading,
    text,
    tokenCount: text.split(/\s+/).length,
  };
}

const chunks: Chunk[] = [
  chunk("a#0", "Hash Tables", "A hash table maps keys to buckets using a hash function.", "Hash Tables"),
  chunk("b#0", "Sorting", "Merge sort divides the array and merges sorted halves.", "Sorting"),
  chunk("c#0", "Sorting", "Quicksort partitions around a pivot and recurses.", "Sorting"),
  chunk("d#0", "Graphs", "Breadth first search explores a graph level by level with a queue.", "Graphs"),
];

describe("Bm25Index", () => {
  const index = new Bm25Index(chunks);

  it("indexes every chunk", () => {
    expect(index.size).toBe(4);
  });

  it("ranks the lexically matching chunk first", () => {
    const results = index.search(tokenizeQuery("merge sort"));
    expect(results[0].chunk.id).toBe("b#0");
  });

  it("returns nothing for an empty query", () => {
    expect(index.search([])).toEqual([]);
  });

  it("returns nothing for terms absent from the corpus", () => {
    expect(index.search(tokenizeQuery("kubernetes helm chart"))).toEqual([]);
  });

  it("assigns strictly positive scores to every returned result", () => {
    const results = index.search(tokenizeQuery("sort"));
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((result) => result.score > 0)).toBe(true);
  });

  it("returns results in descending score order", () => {
    const results = index.search(tokenizeQuery("sort array pivot"));
    const scores = results.map((result) => result.score);
    expect([...scores].sort((x, y) => y - x)).toEqual(scores);
  });

  it("respects the limit", () => {
    expect(index.search(tokenizeQuery("sort"), 1)).toHaveLength(1);
  });

  it("boosts a term that appears in the heading", () => {
    // "graph" appears in d#0's body; the heading boost should keep it top.
    const results = index.search(tokenizeQuery("graph"));
    expect(results[0].chunk.id).toBe("d#0");
  });

  it("benefits from query expansion for an abbreviation", () => {
    // "bfs" appears nowhere in the corpus text, so this only works because
    // tokenizeQuery expands it to breadth/first/search/queue/graph.
    const results = index.search(tokenizeQuery("bfs"));
    expect(results[0]?.chunk.id).toBe("d#0");
  });

  it("does not let a corpus-wide term produce a negative score", () => {
    // "sort" appears in half the corpus, which is where the raw BM25 IDF goes
    // negative. The clamp must keep contributions non-negative.
    const results = index.search(["sort"]);
    expect(results.every((result) => result.score >= 0)).toBe(true);
  });

  it("handles an empty corpus without throwing", () => {
    const empty = new Bm25Index([]);
    expect(empty.size).toBe(0);
    expect(empty.search(tokenizeQuery("anything"))).toEqual([]);
  });

  it("is deterministic across identical queries", () => {
    const first = index.search(tokenizeQuery("sorting algorithms"));
    const second = index.search(tokenizeQuery("sorting algorithms"));
    expect(first.map((r) => r.chunk.id)).toEqual(second.map((r) => r.chunk.id));
  });
});

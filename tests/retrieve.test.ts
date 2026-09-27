/**
 * End-to-end retrieval tests against the real knowledge base.
 *
 * These are the tests that actually prove the RAG layer works: they assert that
 * a realistic student question surfaces the correct document. They need no API
 * key, because retrieval is entirely local.
 */

import { describe, expect, it } from "vitest";
import {
  buildSnippet,
  corpusStats,
  getIndex,
  loadCorpus,
  retrieve,
  toCitations,
  tokenizeQuery,
} from "@/lib/rag";

describe("corpus", () => {
  it("loads every markdown document", () => {
    const docs = loadCorpus();
    expect(docs.length).toBeGreaterThanOrEqual(10);
  });

  it("gives every document an id, title and topic", () => {
    for (const doc of loadCorpus()) {
      expect(doc.id).toBeTruthy();
      expect(doc.title).toBeTruthy();
      expect(doc.topic).toBeTruthy();
      expect(doc.body.length).toBeGreaterThan(200);
    }
  });

  it("has unique document ids", () => {
    const ids = loadCorpus().map((doc) => doc.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("produces a chunked index with unique chunk ids", () => {
    const { chunks } = getIndex();
    expect(chunks.length).toBeGreaterThan(loadCorpus().length);
    expect(new Set(chunks.map((chunk) => chunk.id)).size).toBe(chunks.length);
  });

  it("reports sensible statistics", () => {
    const stats = corpusStats();
    expect(stats.documents).toBeGreaterThanOrEqual(10);
    expect(stats.chunks).toBeGreaterThan(stats.documents);
    expect(stats.topics.length).toBeGreaterThan(1);
    expect(stats.averageChunkTokens).toBeGreaterThan(10);
  });
});

describe("retrieve", () => {
  it("reports bm25 as the retriever used", async () => {
    const result = await retrieve("what is big o notation");
    expect(result.retrieversUsed).toEqual(["bm25"]);
  });

  it("returns at most topK results", async () => {
    const result = await retrieve("sorting", { topK: 3 });
    expect(result.results.length).toBeLessThanOrEqual(3);
  });

  /**
   * The substance of the RAG layer: each question must surface its document.
   * Written as a table so a retrieval regression names the query that broke.
   */
  const expectations: [query: string, expectedDocId: string][] = [
    ["what is big o notation and time complexity", "big-o-complexity"],
    ["how does amortised analysis work for appends", "big-o-complexity"],
    ["explain the two pointer technique", "arrays-and-strings"],
    ["why is string concatenation in a loop slow", "arrays-and-strings"],
    ["how do I reverse a linked list", "linked-lists"],
    ["detect a cycle with tortoise and hare", "linked-lists"],
    ["what is a load factor and when does rehashing happen", "hash-tables"],
    ["difference between separate chaining and open addressing", "hash-tables"],
    ["how does a binary heap priority queue work", "stacks-and-queues"],
    ["why is popping from the front of a python list slow", "stacks-and-queues"],
    ["what is an in-order traversal", "trees-and-binary-search-trees"],
    ["why do we need self balancing trees like red black", "trees-and-binary-search-trees"],
    ["is quicksort stable and what is its worst case", "sorting-algorithms"],
    ["what does timsort do", "sorting-algorithms"],
    ["topological sort with kahn's algorithm", "graphs-and-traversals"],
    ["why can't dijkstra handle negative edge weights", "graphs-and-traversals"],
    ["off by one errors in binary search bounds", "binary-search"],
    ["what is binary search on the answer", "binary-search"],
    ["choose, explore and un-choose backtracking pattern", "recursion-and-backtracking"],
    ["memoisation versus tabulation", "dynamic-programming"],
    ["0/1 knapsack state definition", "dynamic-programming"],
    ["mutable default argument bug in python", "python-fundamentals"],
    ["python generators and lazy evaluation", "python-fundamentals"],
    ["microtask queue versus macrotask queue", "javascript-async-and-event-loop"],
    ["why use promise.all instead of sequential awaits", "javascript-async-and-event-loop"],
    ["what does the liskov substitution principle mean", "oop-principles"],
    ["composition over inheritance", "oop-principles"],
    ["difference between git merge and rebase", "git-fundamentals"],
    ["how do I undo a commit with reset", "git-fundamentals"],
    ["why did my left join turn into an inner join", "sql-and-databases"],
    ["what is an n+1 query problem", "sql-and-databases"],
    ["explain acid and isolation levels", "sql-and-databases"],
  ];

  it.each(expectations)(
    "retrieves %s from the right document",
    async (query, expectedDocId) => {
      const result = await retrieve(query, { topK: 4 });
      const docIds = result.results.map((item) => item.chunk.docId);
      expect(docIds, `top docs were: ${docIds.join(", ")}`).toContain(expectedDocId);
    },
  );

  it("ranks the correct document first for an unambiguous query", async () => {
    const result = await retrieve("reciprocal of a linked list node next pointer reversal");
    expect(result.results[0].chunk.docId).toBe("linked-lists");
  });

  it("returns no results for a query with no lexical overlap", async () => {
    const result = await retrieve("zzzqqq nonexistent gibberish token");
    expect(result.results).toHaveLength(0);
  });

  it("diversifies across documents for a broad query", async () => {
    const result = await retrieve("time and space complexity of data structures", {
      topK: 5,
      diversity: 0.4,
    });
    const docs = new Set(result.results.map((item) => item.chunk.docId));
    expect(docs.size).toBeGreaterThan(1);
  });

  it("filters by topic", async () => {
    const result = await retrieve("complexity", { topic: "Algorithms", topK: 5 });
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results.every((item) => item.chunk.topic === "Algorithms")).toBe(true);
  });

  it("incorporates query expansions and reports them", async () => {
    const result = await retrieve("how do I make lookups fast", {
      expansions: ["hash table constant time lookup"],
      topK: 5,
    });
    expect(result.expansions).toEqual(["hash table constant time lookup"]);
    expect(result.results.map((i) => i.chunk.docId)).toContain("hash-tables");
  });

  it("drops an expansion identical to the original query", async () => {
    const result = await retrieve("binary search", { expansions: ["Binary Search "] });
    expect(result.expansions).toEqual([]);
  });

  it("records which retrievers ran and how long it took", async () => {
    const result = await retrieve("quicksort");
    expect(result.retrieversUsed).toEqual(["bm25"]);
    expect(result.timingMs).toBeGreaterThanOrEqual(0);
  });

  it("exposes fusion signals on each result", async () => {
    const result = await retrieve("merge sort stability");
    expect(result.results[0].signals.bm25).toBeGreaterThan(0);
    expect(result.results[0].signals.ranks.bm25).toBeGreaterThanOrEqual(1);
  });
});

describe("citations", () => {
  it("builds citations with a snippet and provenance", async () => {
    const query = "what is a hash collision";
    const result = await retrieve(query, { topK: 3 });
    const citations = toCitations(result.results, tokenizeQuery(query));

    expect(citations.length).toBeGreaterThan(0);
    for (const citation of citations) {
      expect(citation.docTitle).toBeTruthy();
      expect(citation.heading).toBeTruthy();
      expect(citation.snippet.length).toBeGreaterThan(20);
      expect(citation.snippet.length).toBeLessThan(400);
    }
  });

  it("centres the snippet on the matching terms", () => {
    const chunk = {
      id: "x#0",
      docId: "x",
      docTitle: "X",
      topic: "T",
      tags: [],
      difficulty: "beginner",
      heading: "H",
      text: `${"padding ".repeat(60)}the load factor triggers rehashing${" trailing".repeat(60)}`,
      tokenCount: 10,
    };
    const snippet = buildSnippet(chunk, ["load", "factor", "rehash"], 120);
    expect(snippet).toContain("load factor");
  });

  it("returns short text unchanged", () => {
    const chunk = {
      id: "y#0",
      docId: "y",
      docTitle: "Y",
      topic: "T",
      tags: [],
      difficulty: "beginner",
      heading: "H",
      text: "Short enough.",
      tokenCount: 2,
    };
    expect(buildSnippet(chunk, ["short"])).toBe("Short enough.");
  });
});

describe("snippet formatting", () => {
  it("flattens a markdown table into readable prose, not pipe soup", () => {
    const chunk = {
      id: "t#0",
      docId: "t",
      docTitle: "T",
      topic: "T",
      tags: [],
      difficulty: "beginner",
      heading: "Complexity summary",
      text:
        "| Operation | Complexity |\n|---|---|\n| Access by index | O(1) |\n" +
        "| Insert at front | O(n) |\n",
      tokenCount: 10,
    };
    const snippet = buildSnippet(chunk, ["complexity"], 400);
    expect(snippet).not.toMatch(/\|/);
    expect(snippet).not.toMatch(/---/);
    expect(snippet).toContain("Operation · Complexity");
    expect(snippet).toContain("Access by index · O(1)");
  });

  it("strips code fence markers", () => {
    const chunk = {
      id: "t#1",
      docId: "t",
      docTitle: "T",
      topic: "T",
      tags: [],
      difficulty: "beginner",
      heading: "Example",
      text: "Here is code:\n```python\nx = 1\n```\nDone.",
      tokenCount: 6,
    };
    const snippet = buildSnippet(chunk, ["code"], 400);
    expect(snippet).not.toContain("```");
    expect(snippet).toContain("x = 1");
  });
});

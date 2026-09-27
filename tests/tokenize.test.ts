import { describe, expect, it } from "vitest";
import { stem, termFrequencies, tokenize, tokenizeQuery } from "@/lib/rag/tokenize";

describe("tokenize", () => {
  it("lowercases and strips punctuation", () => {
    expect(tokenize("Hash Tables, and Maps!")).toEqual(["hash", "table", "map"]);
  });

  it("removes stopwords", () => {
    // "the", "of", "a" are stopwords; "array" and "index" survive.
    expect(tokenize("the index of a array")).toEqual(["index", "array"]);
  });

  it("preserves c++ and c# as single terms", () => {
    expect(tokenize("c++ versus c#")).toEqual(["c++", "versus", "c#"]);
  });

  it("keeps multi-character alphanumerics but drops bare digits", () => {
    const terms = tokenize("3nf and 2 and 1nf");
    expect(terms).toContain("3nf");
    expect(terms).toContain("1nf");
    expect(terms).not.toContain("2");
  });

  it("leaves words shorter than four characters alone", () => {
    expect(stem("pos")).toBe("pos");
    expect(stem("bus")).toBe("bus");
  });

  it("does not strip a trailing s after s, u or i", () => {
    // These are the false merges a naive plural rule produces.
    expect(stem("versus")).toBe("versus");
    expect(stem("class")).toBe("class");
    expect(stem("axis")).toBe("axis");
    expect(stem("status")).toBe("status");
  });

  it("strips a genuine plural s", () => {
    expect(stem("sets")).toBe("set");
    expect(stem("maps")).toBe("map");
  });

  it("handles sibilant and -ies plurals", () => {
    expect(stem("classes")).toBe("class");
    expect(stem("indexes")).toBe("index");
    expect(stem("hashes")).toBe("hash");
    expect(stem("queries")).toBe("query");
    expect(stem("tables")).toBe("table");
  });

  it("undoes consonant doubling when stripping -ing", () => {
    expect(stem("getting")).toBe("get");
    expect(stem("running")).toBe("run");
  });

  it("never alters tokens containing digits or symbols", () => {
    expect(stem("c++")).toBe("c++");
    expect(stem("3nf")).toBe("3nf");
    expect(stem("big_o")).toBe("big_o");
  });

  it("stems longer plurals and gerunds to a common root", () => {
    expect(stem("arrays")).toBe("array");
    expect(stem("sorting")).toBe("sort");
    expect(stem("indexes")).toBe("index");
  });

  it("maps singular and plural forms onto the same term", () => {
    expect(tokenize("linked lists")).toEqual(tokenize("linked list"));
  });
});

describe("tokenizeQuery", () => {
  it("expands known abbreviations", () => {
    const terms = tokenizeQuery("explain bfs");
    expect(terms).toContain("breadth");
    expect(terms).toContain("queue");
    expect(terms).toContain("graph");
  });

  it("expands the 'big o' phrasing that spans two tokens", () => {
    const terms = tokenizeQuery("what is big o");
    expect(terms).toContain("complexity");
  });

  it("handles the hyphenated spelling too", () => {
    expect(tokenizeQuery("big-o notation")).toContain("complexity");
  });

  it("maps dict onto hash table vocabulary", () => {
    const terms = tokenizeQuery("how do dicts work");
    expect(terms).toContain("hash");
    expect(terms).toContain("table");
  });

  it("returns unique terms", () => {
    const terms = tokenizeQuery("hash hash hash table");
    expect(new Set(terms).size).toBe(terms.length);
  });

  it("returns an empty list for a query of only stopwords", () => {
    expect(tokenizeQuery("the and of")).toEqual([]);
  });
});

describe("termFrequencies", () => {
  it("counts repeats", () => {
    const tf = termFrequencies(["a", "b", "a", "a"]);
    expect(tf.get("a")).toBe(3);
    expect(tf.get("b")).toBe(1);
  });
});

import { describe, expect, it } from "vitest";
import { chunkDoc, parseDoc, parseFrontmatter } from "@/lib/rag/chunk";
import type { CorpusDoc } from "@/lib/rag/types";

describe("parseFrontmatter", () => {
  it("extracts scalars and flow sequences", () => {
    const { data, body } = parseFrontmatter(
      `---\nid: demo\ntitle: A Demo Doc\ntags: [one, two, three]\n---\n# Heading\n\nBody text.`,
    );
    expect(data.id).toBe("demo");
    expect(data.title).toBe("A Demo Doc");
    expect(data.tags).toEqual(["one", "two", "three"]);
    expect(body).toBe("# Heading\n\nBody text.");
  });

  it("returns the whole input as body when there is no frontmatter", () => {
    const { data, body } = parseFrontmatter("Just text.");
    expect(data).toEqual({});
    expect(body).toBe("Just text.");
  });

  it("ignores malformed lines instead of throwing", () => {
    const { data } = parseFrontmatter(`---\nid: ok\nthis line has no colon\n---\nbody`);
    expect(data.id).toBe("ok");
  });

  it("handles CRLF line endings", () => {
    const { data, body } = parseFrontmatter(`---\r\nid: crlf\r\n---\r\nBody`);
    expect(data.id).toBe("crlf");
    expect(body).toBe("Body");
  });
});

describe("parseDoc", () => {
  it("falls back to the filename when id and title are absent", () => {
    const doc = parseDoc("my-topic.md", "Some body");
    expect(doc.id).toBe("my-topic");
    expect(doc.title).toBe("my topic");
    expect(doc.topic).toBe("General");
    expect(doc.tags).toEqual([]);
  });
});

function makeDoc(body: string): CorpusDoc {
  return {
    id: "test-doc",
    title: "Test Doc",
    topic: "Testing",
    tags: ["tag"],
    difficulty: "beginner",
    body,
  };
}

describe("chunkDoc", () => {
  it("splits on level-2 headings and records them", () => {
    const chunks = chunkDoc(
      makeDoc(
        `## First Section\n${"Alpha content. ".repeat(20)}\n\n## Second Section\n${"Beta content. ".repeat(20)}`,
      ),
    );
    const headings = chunks.map((chunk) => chunk.heading);
    expect(headings).toContain("First Section");
    expect(headings).toContain("Second Section");
  });

  it("gives every chunk a unique id scoped to its document", () => {
    const chunks = chunkDoc(
      makeDoc(`## A\n${"x ".repeat(100)}\n\n## B\n${"y ".repeat(100)}`),
    );
    const ids = chunks.map((chunk) => chunk.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith("test-doc#"))).toBe(true);
  });

  it("carries document metadata onto each chunk", () => {
    const [chunk] = chunkDoc(makeDoc(`## A\n${"content ".repeat(30)}`));
    expect(chunk.docId).toBe("test-doc");
    expect(chunk.docTitle).toBe("Test Doc");
    expect(chunk.topic).toBe("Testing");
    expect(chunk.tokenCount).toBeGreaterThan(0);
  });

  it("windows a section that exceeds maxTokens into several chunks", () => {
    const long = Array.from({ length: 12 }, (_, i) =>
      `Paragraph ${i} ${"filler words ".repeat(30)}`,
    ).join("\n\n");
    const chunks = chunkDoc(makeDoc(`## Long\n${long}`), { maxTokens: 120 });
    expect(chunks.length).toBeGreaterThan(1);
    // Every sub-chunk keeps the section heading for citation purposes.
    expect(chunks.every((chunk) => chunk.heading === "Long")).toBe(true);
  });

  it("merges a tiny section into the following one", () => {
    const chunks = chunkDoc(
      makeDoc(`## Tiny\nShort.\n\n## Real Section\n${"content ".repeat(60)}`),
      { minTokens: 40 },
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toContain("Short.");
    expect(chunks[0].text).toContain("Real Section");
  });

  it("captures content before the first heading as Overview", () => {
    const chunks = chunkDoc(
      makeDoc(`${"intro text ".repeat(40)}\n\n## Later\n${"more ".repeat(40)}`),
    );
    expect(chunks[0].heading).toBe("Overview");
  });

  it("produces no empty chunks", () => {
    const chunks = chunkDoc(makeDoc(`## A\n\n\n## B\n${"x ".repeat(60)}`));
    expect(chunks.every((chunk) => chunk.text.trim().length > 0)).toBe(true);
  });
});

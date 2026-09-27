/**
 * Corpus parsing and heading-aware chunking.
 */

import type { Chunk, CorpusDoc } from "./types";
import { tokenize } from "./tokenize";

/**
 * Minimal YAML frontmatter parser.
 *
 * The corpus frontmatter only ever uses scalars and flow sequences
 * (`tags: [a, b]`), so a full YAML dependency would be dead weight. Anything
 * unrecognised is ignored rather than throwing, so a malformed document
 * degrades to a sensible default instead of breaking the whole index.
 */
export function parseFrontmatter(raw: string): {
  data: Record<string, string | string[]>;
  body: string;
} {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) return { data: {}, body: raw.trim() };

  const data: Record<string, string | string[]> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!key) continue;
    if (value.startsWith("[") && value.endsWith("]")) {
      data[key] = value
        .slice(1, -1)
        .split(",")
        .map((item) => item.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      data[key] = value.replace(/^["']|["']$/g, "");
    }
  }
  return { data, body: raw.slice(match[0].length).trim() };
}

/** Builds a CorpusDoc from raw file contents, filling in missing metadata. */
export function parseDoc(filename: string, raw: string): CorpusDoc {
  const { data, body } = parseFrontmatter(raw);
  const asString = (key: string, fallback: string) =>
    typeof data[key] === "string" ? (data[key] as string) : fallback;

  const fallbackId = filename.replace(/\.md$/i, "");
  return {
    id: asString("id", fallbackId),
    title: asString("title", fallbackId.replace(/-/g, " ")),
    topic: asString("topic", "General"),
    difficulty: asString("difficulty", "unspecified"),
    tags: Array.isArray(data.tags) ? data.tags : [],
    body,
  };
}

/** Rough token estimate used only to size chunks; exact counts are not needed. */
function approximateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface ChunkOptions {
  /** Target upper bound per chunk, in approximate tokens. */
  maxTokens?: number;
  /** Overlap between sub-chunks of an oversized section, in approximate tokens. */
  overlapTokens?: number;
  /** Sections shorter than this are merged into the next one. */
  minTokens?: number;
}

/**
 * Splits a document into chunks along `##` headings.
 *
 * Heading boundaries are used rather than a fixed window because each `##`
 * section in this corpus is a self-contained idea, so a chunk that respects
 * them carries complete context. A section that is too long is then windowed
 * with overlap, and a section that is too short is merged forwards, which
 * avoids both truncated explanations and near-empty chunks.
 */
export function chunkDoc(doc: CorpusDoc, options: ChunkOptions = {}): Chunk[] {
  const maxTokens = options.maxTokens ?? 320;
  const overlapTokens = options.overlapTokens ?? 60;
  const minTokens = options.minTokens ?? 40;

  // Split on level-2 headings, keeping the heading text with its section.
  const sections: { heading: string; text: string }[] = [];
  const lines = doc.body.split(/\r?\n/);
  let heading = "Overview";
  let buffer: string[] = [];

  const flush = () => {
    const text = buffer.join("\n").trim();
    if (text) sections.push({ heading, text });
    buffer = [];
  };

  for (const line of lines) {
    const headingMatch = /^##\s+(.+?)\s*$/.exec(line);
    if (headingMatch) {
      flush();
      heading = headingMatch[1];
      continue;
    }
    buffer.push(line);
  }
  flush();

  // Merge sections that are too small to stand alone as retrieval units.
  const merged: { heading: string; text: string }[] = [];
  for (const section of sections) {
    const previous = merged[merged.length - 1];
    if (previous && approximateTokens(previous.text) < minTokens) {
      previous.text = `${previous.text}\n\n## ${section.heading}\n${section.text}`;
    } else {
      merged.push({ ...section });
    }
  }

  const chunks: Chunk[] = [];
  let ordinal = 0;

  const push = (sectionHeading: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    chunks.push({
      id: `${doc.id}#${ordinal++}`,
      docId: doc.id,
      docTitle: doc.title,
      topic: doc.topic,
      tags: doc.tags,
      difficulty: doc.difficulty,
      heading: sectionHeading,
      text: trimmed,
      tokenCount: tokenize(trimmed).length,
    });
  };

  for (const section of merged) {
    if (approximateTokens(section.text) <= maxTokens) {
      push(section.heading, section.text);
      continue;
    }
    // Oversized section: window it by paragraphs with overlap, so a fenced code
    // block and the prose introducing it usually stay together.
    const paragraphs = section.text.split(/\r?\n\r?\n+/);
    let window: string[] = [];
    let windowTokens = 0;

    for (const paragraph of paragraphs) {
      const size = approximateTokens(paragraph);
      if (windowTokens + size > maxTokens && window.length > 0) {
        push(section.heading, window.join("\n\n"));
        // Retain trailing paragraphs as overlap for the next window.
        const carried: string[] = [];
        let carriedTokens = 0;
        for (let i = window.length - 1; i >= 0; i--) {
          const carriedSize = approximateTokens(window[i]);
          if (carriedTokens + carriedSize > overlapTokens) break;
          carried.unshift(window[i]);
          carriedTokens += carriedSize;
        }
        window = carried;
        windowTokens = carriedTokens;
      }
      window.push(paragraph);
      windowTokens += size;
    }
    push(section.heading, window.join("\n\n"));
  }

  return chunks;
}

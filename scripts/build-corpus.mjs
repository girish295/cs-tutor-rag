#!/usr/bin/env node
/**
 * Compiles the markdown knowledge base into a TypeScript module.
 *
 * Why this exists: reading the corpus with `fs` at runtime made Next trace the
 * whole project into the serverless bundle ("Dynamic filesystem access causes
 * tracing of the whole project"), which bloats deployments and can breach size
 * limits. Emitting a static module instead means the notes are bundled as plain
 * string constants — no filesystem access, no path resolution differences between
 * dev, build, Vitest and Vercel, and a much smaller function.
 *
 * Runs automatically before `dev`, `build` and `test`. Run it by hand with
 * `npm run corpus` after editing anything in lib/rag/corpus/.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CORPUS_DIR = join(process.cwd(), "lib", "rag", "corpus");
const OUTPUT = join(process.cwd(), "lib", "rag", "corpus.generated.ts");

const files = readdirSync(CORPUS_DIR)
  .filter((file) => file.toLowerCase().endsWith(".md"))
  .sort();

if (files.length === 0) {
  console.error(`No .md files found in ${CORPUS_DIR}`);
  process.exit(1);
}

const entries = files.map((filename) => {
  const raw = readFileSync(join(CORPUS_DIR, filename), "utf8");
  // JSON.stringify rather than a template literal: the notes are full of
  // backticks and ${, which would need escaping and is easy to get wrong.
  return `  { filename: ${JSON.stringify(filename)}, raw: ${JSON.stringify(raw)} },`;
});

const output = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Produced by scripts/build-corpus.mjs from the markdown in lib/rag/corpus/.
 * Regenerate with \`npm run corpus\`.
 */

export interface RawCorpusFile {
  filename: string;
  raw: string;
}

export const CORPUS_FILES: RawCorpusFile[] = [
${entries.join("\n")}
];
`;

writeFileSync(OUTPUT, output, "utf8");

const bytes = Buffer.byteLength(output, "utf8");
console.log(
  `corpus: ${files.length} documents → lib/rag/corpus.generated.ts (${Math.round(
    bytes / 1024,
  )} KB)`,
);

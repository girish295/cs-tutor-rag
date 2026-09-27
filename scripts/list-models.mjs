#!/usr/bin/env node
/**
 * Lists the models your Groq key can actually reach.
 *
 * Model IDs on Groq change as models are retired, which makes a hardcoded id the
 * most likely thing to break this project over time. Run this to find the
 * current names, then set GROQ_TEXT_MODEL / GROQ_VISION_MODEL in .env.local.
 *
 *   npm run models
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/** Minimal .env reader — avoids a dependency just to run one script. */
function loadEnvFile(filename) {
  const path = join(process.cwd(), filename);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const value = match[2].replace(/^["']|["']$/g, "");
    if (value && !process.env[match[1]]) process.env[match[1]] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const apiKey = process.env.GROQ_API_KEY?.trim();

if (!apiKey) {
  console.error(
    "No GROQ_API_KEY found.\n\n" +
      "Add it to .env.local (copy .env.example), or run:\n" +
      "  GROQ_API_KEY=gsk_... npm run models\n\n" +
      "Get a free key at https://console.groq.com/keys",
  );
  process.exit(1);
}

const response = await fetch("https://api.groq.com/openai/v1/models", {
  headers: { authorization: `Bearer ${apiKey}` },
});

if (!response.ok) {
  console.error(
    `Groq returned ${response.status} ${response.statusText}.\n` +
      (response.status === 401
        ? "That usually means the key is invalid or revoked."
        : await response.text().catch(() => "")),
  );
  process.exit(1);
}

const payload = await response.json();
const models = (payload.data ?? [])
  .map((model) => ({
    id: model.id,
    owner: model.owned_by ?? "—",
    context: model.context_window ?? null,
    active: model.active !== false,
  }))
  .sort((a, b) => a.id.localeCompare(b.id));

if (models.length === 0) {
  console.log("No models returned for this key.");
  process.exit(0);
}

const width = Math.max(...models.map((model) => model.id.length));

console.log(`\n${models.length} models available to this key:\n`);
for (const model of models) {
  const context = model.context ? `${(model.context / 1024).toFixed(0)}k ctx` : "";
  console.log(
    `  ${model.id.padEnd(width)}  ${String(model.owner).padEnd(14)} ${context}` +
      (model.active ? "" : "  [inactive]"),
  );
}

// Guess sensible picks so the output is directly actionable.
const ids = models.filter((model) => model.active).map((model) => model.id);
const guess = (patterns) => ids.find((id) => patterns.some((p) => p.test(id)));

const text = guess([/llama-3\.3-70b/, /gpt-oss-120b/, /versatile/, /instruct/]);
const vision = guess([/qwen3/, /llama-4/, /vision/, /scout/, /maverick/]);

console.log("\nSuggested .env.local entries:\n");
console.log(`  GROQ_TEXT_MODEL=${text ?? "<pick a text model above>"}`);
console.log(`  GROQ_VISION_MODEL=${vision ?? "<pick a vision model above>"}`);
console.log(
  "\nNote: this endpoint does not report vision support, so verify the vision " +
    "model against https://console.groq.com/docs/vision\n",
);

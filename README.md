# CS Tutor — Multimodal RAG Chatbot

An ed-tech chatbot for computer science and programming fundamentals. It answers
questions from a curated knowledge base of 16 course documents, cites the exact
passages it used, accepts images as well as text, and can generate an
interactive quiz as a real UI widget rather than a wall of text.

Built with Next.js 16, the Vercel AI SDK v7 and Groq.

> **It runs with no API key.** Clone, `npm install`, `npm run dev` — the app
> starts in **demo mode**, where retrieval, tool calls and the interactive quiz
> are all genuinely executed. Only the prose is assembled from the retrieved
> passages instead of written by a model. Add a Groq key to get real tutored
> answers and image understanding.

---

## Contents

- [Quick start](#quick-start)
- [Demo guide](#demo-guide) — what to click to see each feature
- [How it works](#how-it-works)
- [Retrieval architecture](#retrieval-architecture)
- [Deploying to Vercel](#deploying-to-vercel)
- [Project structure](#project-structure)
- [Testing](#testing)
- [Design decisions and limitations](#design-decisions-and-limitations)

---

## Quick start

Requires Node 20.9 or newer.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The app works immediately, in demo mode.

### Enabling live mode (recommended)

Get a free key at <https://console.groq.com/keys>, then:

```bash
cp .env.example .env.local
```

Put the key in `.env.local`:

```
GROQ_API_KEY=gsk_your_key_here
```

Restart the dev server. The sidebar badge changes from `demo` to `live`, and
answers are then written by the model, grounded in the retrieved passages.

### If a model ID has been retired

Groq renames and retires models regularly, so the defaults here may age out.
This will show as a "model was rejected by Groq" error in the chat. To fix it:

```bash
npm run models
```

That lists every model your key can actually reach and prints suggested
`.env.local` entries. Set `GROQ_TEXT_MODEL` and `GROQ_VISION_MODEL` accordingly.

---

## Demo guide

Each of these exercises a different requirement. They all work in demo mode
except where noted.

### 1. Retrieval-augmented answering with citations

Click **"Why is quicksort O(n^2) in the worst case, and how is it avoided?"**

You will see a **Knowledge base** panel appear above the answer showing the query
the system searched for, how many passages matched, which retriever ran and how
long it took. Click **Show sources** to expand every retrieved passage with its
document title, section heading and fusion score.

This panel is the point of the project: it makes the RAG verifiable. You can
check that a cited claim is actually supported by the passage behind it, rather
than taking the answer on trust.

### 2. Tool calling and generative UI

Type **`quiz me on hash tables`**.

The model calls the `generateQuiz` tool, and the result renders as a real
interactive quiz — selectable options, a **Check answers** button, a score, and a
per-question explanation revealed after submitting. Try getting one wrong: the
chosen answer turns red with a ✗, the correct one green with a ✓, and the
explanation says why.

Nothing about this is a chat bubble. The tool output *becomes the interface*.

### 3. Image input (needs a Groq key)

Click the paperclip, or paste, or drag an image onto the composer. Try a photo of
a handwritten problem or a screenshot of buggy code.

In live mode the request is routed to the vision model automatically, and the
system prompt instructs it to describe what it sees, transcribe the code, and
then answer using the knowledge base. In demo mode the upload, preview and
request plumbing all run for real, and the reply confirms the image was received
and explains that analysis needs a key.

Limits: 3 images per message, 8 MB each — both enforced client-side and in the
API route.

### 4. Scoped retrieval

In the sidebar, set **Restrict retrieval to a topic** to `Databases`, then ask
**"how do indexes and complexity work"**.

Retrieval is now confined to the database notes. Clear the filter and ask again —
the same question now pulls from five different documents. This also demonstrates
the diversification step, which deliberately prevents one document from filling
the whole context window.

### 5. Query expansion

Ask **`how do dicts work`**.

The string "dicts" appears nowhere in the knowledge base — the notes say
"dictionary" and "hash table" — yet *Hash Tables, Hash Maps and Sets* is
retrieved. Queries are expanded against an alias table before searching, so
`dicts` → dictionary, hash, table, map. The same applies to `bfs`, `dp`,
`big o`, `js` and others.

### 6. Other things worth trying

| Try this | What it shows |
|---|---|
| `why did my LEFT JOIN behave like an INNER JOIN?` | A real SQL trap, answered from the notes |
| `explain the mutable default argument bug in Python` | Retrieval on a specific gotcha |
| `microtask queue versus macrotask queue` | Precise technical phrasing matched exactly |
| `zzzq nonsense` | Honest "nothing matched" handling — no hallucinated citation |
| The ☀ / ◐ / ☾ buttons | Light, system and dark themes, with no flash on reload |
| Resize to phone width | Sidebar becomes a drawer; no horizontal scroll |
| `curl localhost:3000/api/health` | Corpus stats and active configuration as JSON |

---

## How it works

```
                 ┌─────────────────────────────────────────┐
  user message   │  app/api/chat/route.ts                  │
  (text + image) │  · validates, caps history              │
  ──────────────▶│  · routes to vision model if image      │
                 │  · demo mode if no GROQ_API_KEY         │
                 └────────────────┬────────────────────────┘
                                  │
                       streamText + tools
                                  │
            ┌─────────────────────┴───────────────────┐
            ▼                                         ▼
  ┌───────────────────────┐              ┌────────────────────────┐
  │ searchKnowledgeBase   │              │ generateQuiz           │
  │ · BM25F over chunks   │              │ · model authors Qs     │
  │ · query expansion     │              │ · validated + repaired │
  │ · RRF + diversify     │              └───────────┬────────────┘
  └───────────┬───────────┘                          │
              │ citations                            │ quiz payload
              ▼                                      ▼
      RetrievalPanel.tsx                       QuizCard.tsx
   (sources, scores, timing)              (interactive, scored)
```

**Retrieval is a tool, not a preprocessing step.** Many RAG tutorials retrieve
unconditionally before every model call. Making it a tool means the model decides
*when* it needs the notes and *what* to search for — so "hi" costs no retrieval, a
follow-up can re-search with better terms, and a multi-part question can issue
several targeted searches in one turn. It also makes every retrieval visible in
the transcript, which is what the inspector panel renders.

---

## Retrieval architecture

The pipeline, in order:

1. **Chunking** (`lib/rag/chunk.ts`) — documents split on `##` headings, because
   each section in this corpus is one self-contained idea. Oversized sections are
   windowed with overlap; undersized ones merge forward. 16 documents → 119
   passages, averaging ~82 tokens.

2. **Tokenisation** (`lib/rag/tokenize.ts`) — lowercasing, stopword removal and
   conservative stemming. The guards matter more than the rules: a naive plural
   rule turns `versus` into `versu` and `class` into `clas`, so a trailing `s` is
   only dropped when the preceding letter is not `s`, `u` or `i`. Tokens
   containing digits or symbols (`c++`, `3nf`, `O(1)`) are never altered.

3. **Query expansion** — abbreviations and informal phrasings are mapped onto
   corpus vocabulary (`bfs` → breadth/first/search/queue/graph). Applied to
   queries only; expanding documents would distort the term statistics BM25
   depends on.

4. **BM25F ranking** (`lib/rag/bm25.ts`) — a chunk is scored as two fields, its
   body and its metadata (document title, section heading, tags), with metadata
   terms folded into the frequency map at 2.5× weight.

   > This is not a cosmetic detail. The first implementation applied the heading
   > boost as a *multiplier on the body score*, which meant a term appearing only
   > in a heading had a body frequency of zero and scored zero no matter how
   > large the multiplier. A query for "the two-pointer technique" ranked the
   > correct section **7th**. Folding metadata into the frequencies moved it to
   > **1st**. There is a regression test for this.

5. **Rank fusion** (`lib/rag/fuse.ts`) — the original query and each expansion
   produce separate ranked lists, fused with Reciprocal Rank Fusion. RRF combines
   lists using only each item's *rank*, never its raw score, which sidesteps the
   fact that scores from different formulations are not comparable.

6. **Diversification** — a greedy MMR-style pass penalises repeated documents, so
   a broad question returns a spread of sources rather than five near-identical
   chunks from one file.

7. **Snippet extraction** (`lib/rag/index.ts`) — the citation snippet is centred
   on the densest cluster of query terms, so it shows the sentence that actually
   matched. Markdown tables are flattened to `cell · cell` rather than collapsing
   into unreadable pipe soup.

### Why there are no embeddings

This is a deliberate choice, not a missing feature:

- **Groq has no embeddings endpoint.** Dense retrieval would require a second
  provider and a second API key, breaking the "works with no setup" property the
  demo mode depends on.
- **The corpus suits lexical search.** CS questions are dense with exact
  technical terms — "amortised", `LEFT JOIN`, "tail call" — and exact matching is
  genuinely strong on this kind of text.
- **Query expansion recovers most of the rest.** The main thing embeddings buy
  here is vocabulary mismatch, which the alias table handles for the cases that
  actually occur.

The honest trade-off: this will not match a paraphrase that shares no vocabulary
with the notes and isn't in the alias table. At a larger corpus size, or with
more varied phrasing, a hybrid dense/sparse retriever would be the right next
step — the fusion layer is already built for multiple ranked lists.

---

## Deploying to Vercel

1. Push this repository to GitHub.
2. At <https://vercel.com/new>, import the repository. The framework is detected
   automatically; no build settings need changing.
3. Add one environment variable: **`GROQ_API_KEY`**.
   (Skip it and the deployment still works, in demo mode.)
4. Deploy.

Once deployed, `https://your-app.vercel.app/api/health` returns the corpus
statistics and active configuration — a quick way to confirm the knowledge base
was bundled correctly.

**A note on bundling.** The markdown corpus is compiled into a TypeScript module
by `scripts/build-corpus.mjs`, which runs automatically before `dev`, `build` and
`test`. An earlier version read the files with `fs` at runtime, which made Next
trace the *entire project* into the serverless function. Compiling to a module
removed that, and removed the path-resolution differences between local dev,
Vitest and a serverless function at the same time.

After editing anything in `lib/rag/corpus/`, run `npm run corpus` (or just
restart the dev server).

---

## Project structure

```
app/
  api/chat/route.ts      Chat endpoint: validation, model routing, streaming
  api/health/route.ts    Corpus stats + configuration, for smoke tests
  page.tsx               Server component; reads corpus stats on the server
  layout.tsx             Theme bootstrap script (prevents flash of wrong theme)
  globals.css            Design tokens, light/dark, markdown prose styles

components/
  chat/                  Chat shell, composer, markdown, part dispatcher, sidebar
  tools/                 RetrievalPanel (sources) and QuizCard (interactive quiz)
  ui/primitives.tsx      Shared card chrome, badges, pending and error states

lib/
  rag/
    corpus/*.md          The knowledge base — 16 documents, plain markdown
    chunk.ts             Frontmatter parsing and heading-aware chunking
    tokenize.ts          Tokenisation, stemming, query expansion
    bm25.ts              BM25F ranking
    fuse.ts              Reciprocal Rank Fusion + diversification
    index.ts             Public API: loadCorpus, retrieve, toCitations
  tools/                 Tool definitions (searchKnowledgeBase, generateQuiz)
  demo/demo-stream.ts    The no-API-key response stream
  prompt.ts              System prompt
  config.ts              Mode detection, model IDs, request limits

scripts/
  build-corpus.mjs       Compiles the markdown corpus into a TS module
  list-models.mjs        Lists models your Groq key can reach

tests/                   107 tests, no API key required
```

### Adding to the knowledge base

Drop a markdown file into `lib/rag/corpus/` with this frontmatter:

```markdown
---
id: my-topic
title: My Topic
topic: Algorithms
tags: [tag-one, tag-two]
difficulty: beginner
---

## First section

Content. Sections split on `##` headings, so give each one a clear heading.
```

Then `npm run corpus`. Nothing else needs changing — chunking, indexing and the
sidebar all pick it up automatically.

---

## Testing

```bash
npm test         # 107 tests
npm run typecheck
npm run lint
npm run build
```

No API key is needed for any of these, because the retrieval layer imports
nothing from the AI SDK — that separation is what makes both the tests and the
demo mode possible.

The most valuable tests are in `tests/retrieve.test.ts`: a table of 32 realistic
student questions, each asserting that the correct document is retrieved. A
retrieval regression names the exact query that broke.

---

## Design decisions and limitations

**What is honest about demo mode.** Demo mode does not fake retrieval or the
widgets — those execute for real. It fakes only the *writing*, by assembling an
extractive summary of the retrieved passages, and it says so in the reply itself
and in the sidebar. The quiz shown in demo mode is hand-authored sample content,
clearly labelled `(sample)`; in live mode the model generates questions from what
it retrieved.

**Model IDs are configurable, not hardcoded.** Groq's documentation and the AI
SDK's provider documentation disagreed about which model currently serves vision
(`qwen/qwen3.8-27b` versus the Llama 4 models) at the time this was written.
Rather than guess, both are documented, the default is overridable by environment
variable, `npm run models` lists what your key can actually reach, and the error
handler for a rejected model ID names the fix explicitly.

**Not implemented.** No conversation persistence — reloading starts a new chat.
No authentication or rate limiting, which a real deployment would need. No
streaming of tool *inputs* into the UI (the pending state is a spinner rather
than showing the quiz being written). Chat history is capped at 40 turns.

**Tooling versions.** TypeScript is pinned to 6.x and ESLint to 9.x because
`typescript-eslint` does not yet support TypeScript 7, and `eslint-plugin-react`
is not yet compatible with ESLint 10. Both are upstream ecosystem gaps rather
than constraints of this code; the app itself builds fine on either.

---

## Licence

MIT.

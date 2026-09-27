/**
 * Tokenisation for lexical retrieval.
 *
 * Hand-written rather than pulled from a dependency for three reasons: the
 * corpus is CS text with identifiers that generic tokenisers mangle (`O(n)`,
 * `c++`, `.then`), it must run identically on server and in tests, and it keeps
 * the bundle small enough for a serverless function.
 */

/**
 * Stopwords are removed from both documents and queries. Deliberately excludes
 * words that carry meaning in a CS corpus even though they are common English:
 * "not" (negation matters), "all"/"any" (quantifiers appear in `all`/`any`),
 * and "in"/"is" (kept out of this list would break `is`/`in` operator queries).
 */
const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "being", "but", "by",
  "can", "did", "do", "does", "for", "from", "had", "has", "have", "he", "her",
  "here", "him", "his", "how", "i", "if", "into", "it", "its", "just", "me",
  "my", "of", "on", "or", "our", "out", "she", "so", "some", "such", "than",
  "that", "the", "their", "them", "then", "there", "these", "they", "this",
  "those", "to", "up", "us", "was", "we", "were", "what", "when", "where",
  "which", "who", "why", "will", "with", "would", "you", "your",
]);

/**
 * Query-side alias expansion. Maps how learners actually phrase things onto the
 * vocabulary the corpus uses. This is the single highest-value addition to
 * lexical retrieval quality here, because a student asking about "dicts" or
 * "big o" will not match a document that says "hash table" or "complexity".
 *
 * Applied to queries only, never to documents: expanding documents would
 * distort the term statistics BM25 depends on.
 */
const ALIASES: Record<string, string[]> = {
  bigo: ["complexity", "asymptotic", "growth"],
  o: ["complexity"],
  dict: ["dictionary", "hash", "table", "map"],
  dicts: ["dictionary", "hash", "table", "map"],
  hashmap: ["hash", "table", "map"],
  map: ["hash", "table", "dictionary"],
  js: ["javascript"],
  py: ["python"],
  ts: ["typescript", "javascript"],
  dsa: ["data", "structure", "algorithm"],
  ds: ["data", "structure"],
  algo: ["algorithm"],
  algos: ["algorithm"],
  dp: ["dynamic", "programming", "memoisation", "tabulation"],
  bfs: ["breadth", "first", "search", "queue", "graph"],
  dfs: ["depth", "first", "search", "stack", "graph"],
  bst: ["binary", "search", "tree"],
  ll: ["linked", "list"],
  pq: ["priority", "queue", "heap"],
  oop: ["object", "oriented", "class", "inheritance"],
  db: ["database", "sql"],
  sql: ["database", "query", "join"],
  join: ["sql", "database"],
  recursion: ["recursive", "base", "case"],
  memo: ["memoisation", "cache"],
  memoization: ["memoisation"],
  optimization: ["optimisation"],
  normalization: ["normalisation"],
  async: ["asynchronous", "promise", "await"],
  promise: ["async", "await", "then"],
  vcs: ["git", "version", "control"],
  interview: ["question", "practice"],
  tc: ["time", "complexity"],
  sc: ["space", "complexity"],
};

/**
 * Very light suffix stripping. A full Porter stemmer is overkill here and
 * introduces its own false merges; this handles only the plural and gerund
 * forms that actually cause retrieval misses in this corpus.
 *
 * The guards matter more than the rules. Naive trailing-`s` removal turns
 * `versus` into `versu`, `class` into `clas` and `axis` into `axi`, none of
 * which match anything — so an `s` is only dropped when the preceding letter is
 * not `s`, `u` or `i`.
 */
export function stem(word: string): string {
  // Tokens containing digits or symbols are identifiers (`c++`, `3nf`, `big_o`)
  // and must never be altered.
  if (word.length < 4 || !/^[a-z]+$/.test(word)) return word;

  // -ies -> -y : queries -> query, properties -> property
  if (word.length >= 5 && word.endsWith("ies")) {
    return `${word.slice(0, -3)}y`;
  }

  if (word.length >= 5 && word.endsWith("es")) {
    const before = word[word.length - 3];
    // A sibilant stem takes a full `-es` plural: classes -> class,
    // boxes -> box, hashes -> hash, matches -> match.
    const sibilant =
      before === "s" ||
      before === "x" ||
      before === "z" ||
      word.endsWith("ches") ||
      word.endsWith("shes");
    // Otherwise only the `s` is the plural marker: tables -> table,
    // values -> value, phases -> phase, nodes -> node.
    return sibilant ? word.slice(0, -2) : word.slice(0, -1);
  }

  if (word.endsWith("s")) {
    const before = word[word.length - 2];
    if (before !== "s" && before !== "u" && before !== "i") {
      return word.slice(0, -1); // maps -> map, arrays -> array, sets -> set
    }
    return word;
  }

  // -ing / -ed : sorting -> sort, hashed -> hash
  for (const suffix of ["ing", "ed"] as const) {
    const minLength = suffix === "ing" ? 6 : 5;
    if (word.length >= minLength && word.endsWith(suffix)) {
      let base = word.slice(0, -suffix.length);
      // Undo consonant doubling: getting -> gett -> get, running -> runn -> run.
      if (
        base.length >= 3 &&
        base[base.length - 1] === base[base.length - 2] &&
        !"aeiou".includes(base[base.length - 1])
      ) {
        base = base.slice(0, -1);
      }
      return base.length >= 3 ? base : word;
    }
  }

  return word;
}

/**
 * Splits text into normalised terms.
 *
 * Keeps `+` and `#` when they trail a word so that `c++` and `c#` survive as
 * distinct terms, and preserves digits so that `3nf`, `1nf` and `2^n` remain
 * searchable.
 */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  // Match word-ish runs, optionally followed by ++ or #, so c++/c# stay whole.
  const matches = text.toLowerCase().matchAll(/[a-z0-9_]+(?:\+\+|#)?/g);
  for (const match of matches) {
    const raw = match[0];
    if (raw.length === 0) continue;
    if (STOPWORDS.has(raw)) continue;
    // Bare single digits carry no retrieval signal and bloat the index.
    if (raw.length === 1 && /[0-9]/.test(raw)) continue;
    out.push(stem(raw));
  }
  return out;
}

/**
 * Tokenises a query and appends alias expansions.
 *
 * Aliases are looked up on the *unstemmed* token, because the alias table is
 * written in surface form, then the expansion itself is stemmed so it matches
 * the index.
 */
export function tokenizeQuery(query: string): string[] {
  const terms = new Set<string>();
  const matches = query.toLowerCase().matchAll(/[a-z0-9_]+(?:\+\+|#)?/g);
  for (const match of matches) {
    const raw = match[0];
    if (raw.length === 0) continue;
    if (!STOPWORDS.has(raw) && !(raw.length === 1 && /[0-9]/.test(raw))) {
      terms.add(stem(raw));
    }
    for (const expansion of ALIASES[raw] ?? []) {
      terms.add(stem(expansion));
    }
  }
  // "big o" and "big-o" arrive as two tokens; catch that phrasing explicitly.
  if (/\bbig[\s-]?o\b/i.test(query)) {
    for (const t of ["complexity", "asymptotic", "growth"]) terms.add(stem(t));
  }
  return [...terms];
}

/** Term frequency map for a token list. */
export function termFrequencies(terms: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const term of terms) tf.set(term, (tf.get(term) ?? 0) + 1);
  return tf;
}

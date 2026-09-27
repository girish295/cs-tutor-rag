/**
 * Runtime configuration and mode detection.
 *
 * The app has two modes. **Live mode** requires `GROQ_API_KEY` and talks to
 * Groq. **Demo mode** activates automatically when that key is absent and serves
 * a scripted response stream instead — real retrieval, real tool execution and
 * real interactive widgets, but no model call. Demo mode exists so the project
 * can be run and reviewed without anyone having to obtain a key first.
 */

export type AppMode = "live" | "demo";

export function getMode(): AppMode {
  return process.env.GROQ_API_KEY?.trim() ? "live" : "demo";
}

/**
 * Model IDs are read from the environment rather than hardcoded because Groq
 * retires and renames models regularly, and a hardcoded id is the single most
 * likely thing to break this app months from now.
 *
 * Run `npm run models` with a key set to list what your account can reach.
 */
export const MODEL_DEFAULTS = {
  /** Text and tool-calling. Listed as a Groq production model. */
  text: "llama-3.3-70b-versatile",
  /** Vision. Named by Groq's vision documentation. */
  vision: "qwen/qwen3.8-27b",
} as const;

/** Alternates to suggest in an error message when a model id is rejected. */
export const MODEL_ALTERNATES = {
  text: ["openai/gpt-oss-120b", "llama-3.1-8b-instant", "openai/gpt-oss-20b"],
  vision: [
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "meta-llama/llama-4-maverick-17b-128e-instruct",
  ],
} as const;

export function resolveModelIds() {
  return {
    text: process.env.GROQ_TEXT_MODEL?.trim() || MODEL_DEFAULTS.text,
    vision: process.env.GROQ_VISION_MODEL?.trim() || MODEL_DEFAULTS.vision,
  };
}

/** Surfaced in the UI status panel and by /api/health. */
export function getCapabilities() {
  return {
    mode: getMode(),
    models: resolveModelIds(),
  };
}

/** Hard caps on request payloads, enforced in the chat route. */
export const LIMITS = {
  /** Maximum images accepted per request — Groq's vision limit is 3. */
  maxImagesPerRequest: 3,
  /** Maximum decoded size of a single uploaded image. */
  maxImageBytes: 8 * 1024 * 1024,
  /** Maximum conversation turns forwarded to the model. */
  maxMessages: 40,
  /** Tool-calling loop bound. */
  maxSteps: 5,
} as const;

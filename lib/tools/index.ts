/**
 * The tool registry.
 *
 * Exported as one object so the route, the type definitions for `useChat` and
 * the UI's part renderer all stay in sync — adding a tool here is the only place
 * its name is declared.
 */

import { generateQuiz } from "./quiz";
import { searchKnowledgeBase } from "./knowledge-base";

export const tools = {
  searchKnowledgeBase,
  generateQuiz,
} as const;

export type AppTools = typeof tools;

/** Labels shown while a tool call is in flight. */
export const TOOL_LABELS: Record<keyof AppTools, string> = {
  searchKnowledgeBase: "Searching the knowledge base",
  generateQuiz: "Building a quiz",
};

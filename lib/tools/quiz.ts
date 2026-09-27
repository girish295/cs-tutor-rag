/**
 * Quiz generation — the primary generative-UI tool.
 *
 * The model authors the questions as the tool's *input*; `execute` validates
 * them, shuffles nothing (order is the model's choice) and returns a normalised
 * payload that the `QuizCard` component renders as a real interactive quiz with
 * scoring. Nothing here is a chat bubble: the tool output becomes UI.
 */

import { tool } from "ai";
import { z } from "zod";

const questionSchema = z.object({
  question: z.string().min(5).max(400),
  options: z
    .array(z.string().min(1).max(300))
    .min(2)
    .max(5)
    .describe("Answer options. Exactly one must be correct."),
  correctIndex: z
    .number()
    .int()
    .min(0)
    .max(4)
    .describe("Zero-based index into options of the correct answer."),
  explanation: z
    .string()
    .min(5)
    .max(600)
    .describe("Why the correct answer is right, and why a tempting wrong one is not."),
});

export const generateQuiz = tool({
  description:
    "Create an interactive multiple-choice quiz that is rendered as a real " +
    "clickable widget with scoring. Use it when the user asks to be tested, " +
    "quizzed, or to practise a topic. Base the questions on knowledge-base " +
    "passages you have already retrieved, so the answers are grounded. " +
    "Do not also restate the questions in your text reply — the widget shows them.",
  inputSchema: z.object({
    title: z.string().min(3).max(120).describe("Short quiz title, e.g. 'Big-O Basics'."),
    topic: z.string().min(2).max(80).describe("The topic being tested."),
    difficulty: z
      .enum(["beginner", "intermediate", "advanced"])
      .describe("Overall difficulty of the question set."),
    questions: z
      .array(questionSchema)
      .min(1)
      .max(8)
      .describe("Between 3 and 5 questions is usually right unless asked otherwise."),
  }),
  execute: async ({ title, topic, difficulty, questions }) => {
    /**
     * Models occasionally emit a `correctIndex` past the end of `options`. Left
     * unchecked that renders a quiz with no winning answer, so it is clamped
     * here and reported, rather than trusted or thrown away.
     */
    const repaired: string[] = [];
    const normalised = questions.map((question, index) => {
      let correctIndex = question.correctIndex;
      if (correctIndex >= question.options.length) {
        repaired.push(`Q${index + 1}`);
        correctIndex = 0;
      }
      return { ...question, correctIndex };
    });

    return {
      title,
      topic,
      difficulty,
      questionCount: normalised.length,
      questions: normalised,
      ...(repaired.length > 0
        ? { warning: `Out-of-range answer index corrected for ${repaired.join(", ")}.` }
        : {}),
    };
  },
});

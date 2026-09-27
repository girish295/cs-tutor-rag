"use client";

/**
 * Renders the `generateQuiz` tool result as a genuinely interactive quiz.
 *
 * The state — which option is selected per question, whether answers are
 * revealed, the score — lives in this component. Nothing is sent back to the
 * model, because grading a multiple-choice quiz needs no model and a round trip
 * would only add latency.
 */

import { useMemo, useState } from "react";

import { Badge, ToolShell, cx } from "@/components/ui/primitives";

export interface QuizPayload {
  title: string;
  topic: string;
  difficulty: string;
  questionCount?: number;
  warning?: string;
  questions: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }[];
}

export function QuizCard({ data }: { data: QuizPayload }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  // Memoised so the identity is stable across renders; otherwise the `?? []`
  // fallback allocates a new array each time and invalidates the score memo.
  const questions = useMemo(() => data.questions ?? [], [data.questions]);
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === questions.length && questions.length > 0;

  const score = useMemo(
    () =>
      questions.reduce(
        (total, question, index) =>
          answers[index] === question.correctIndex ? total + 1 : total,
        0,
      ),
    [answers, questions],
  );

  const reset = () => {
    setAnswers({});
    setSubmitted(false);
  };

  if (questions.length === 0) {
    return (
      <ToolShell icon={<QuizIcon />} title={data.title || "Quiz"} tone="accent">
        <p className="px-4 py-3 text-sm" style={{ color: "var(--ink-2)" }}>
          No questions were generated.
        </p>
      </ToolShell>
    );
  }

  return (
    <ToolShell
      icon={<QuizIcon />}
      title={data.title}
      subtitle={`${data.topic} · ${data.difficulty}`}
      tone="accent"
      badge={
        submitted ? (
          <Badge tone={score === questions.length ? "good" : score === 0 ? "bad" : "warn"}>
            {score} / {questions.length}
          </Badge>
        ) : (
          <Badge>
            {answeredCount} / {questions.length} answered
          </Badge>
        )
      }
    >
      <ol className="divide-y" style={{ borderColor: "var(--border-1)" }}>
        {questions.map((question, questionIndex) => {
          const selected = answers[questionIndex];
          const isCorrect = selected === question.correctIndex;

          return (
            <li
              key={questionIndex}
              className="px-3 py-3 sm:px-4"
              style={{ borderColor: "var(--border-1)" }}
            >
              <div className="flex gap-2">
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                  style={{ background: "var(--surface-3)", color: "var(--ink-2)" }}
                >
                  {questionIndex + 1}
                </span>
                <p
                  className="text-sm font-medium leading-relaxed"
                  style={{ color: "var(--ink-1)" }}
                >
                  {question.question}
                </p>
              </div>

              <div className="mt-2.5 ml-7 grid gap-1.5">
                {question.options.map((option, optionIndex) => {
                  const isSelected = selected === optionIndex;
                  const isAnswer = optionIndex === question.correctIndex;

                  // Colour only appears after submission, and always alongside a
                  // ✓/✗ glyph and text, never as the sole signal.
                  let background = "var(--surface-1)";
                  let borderColor = "var(--border-1)";
                  let color = "var(--ink-1)";

                  if (submitted && isAnswer) {
                    background = "var(--good-soft)";
                    borderColor = "var(--good)";
                    color = "var(--good)";
                  } else if (submitted && isSelected && !isAnswer) {
                    background = "var(--bad-soft)";
                    borderColor = "var(--bad)";
                    color = "var(--bad)";
                  } else if (isSelected) {
                    background = "var(--accent-soft)";
                    borderColor = "var(--accent)";
                  }

                  return (
                    <button
                      key={optionIndex}
                      type="button"
                      disabled={submitted}
                      onClick={() =>
                        setAnswers((previous) => ({
                          ...previous,
                          [questionIndex]: optionIndex,
                        }))
                      }
                      className={cx(
                        "flex items-start gap-2 rounded-lg border px-2.5 py-2 text-left text-[13px] transition-colors",
                        !submitted && "hover:border-[var(--accent)]",
                        submitted && "cursor-default",
                      )}
                      style={{ background, borderColor, color }}
                      aria-pressed={isSelected}
                    >
                      <span
                        className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold"
                        style={{ borderColor: "currentColor" }}
                        aria-hidden
                      >
                        {submitted && isAnswer
                          ? "✓"
                          : submitted && isSelected
                            ? "✗"
                            : String.fromCharCode(65 + optionIndex)}
                      </span>
                      <span className="leading-snug">{option}</span>
                    </button>
                  );
                })}
              </div>

              {submitted ? (
                <div
                  className="mt-2 ml-7 rounded-lg border px-2.5 py-2 text-[13px] leading-relaxed"
                  style={{
                    borderColor: "var(--border-1)",
                    background: "var(--surface-2)",
                    color: "var(--ink-2)",
                  }}
                >
                  <strong style={{ color: isCorrect ? "var(--good)" : "var(--bad)" }}>
                    {isCorrect ? "Correct." : "Not quite."}
                  </strong>{" "}
                  {question.explanation}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      <footer
        className="flex flex-wrap items-center gap-2 border-t px-3 py-2.5 sm:px-4"
        style={{ borderColor: "var(--border-1)", background: "var(--surface-2)" }}
      >
        {!submitted ? (
          <button
            type="button"
            disabled={!allAnswered}
            onClick={() => setSubmitted(true)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium transition-opacity disabled:opacity-40"
            style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
          >
            Check answers
          </button>
        ) : (
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border px-3 py-1.5 text-sm font-medium"
            style={{ borderColor: "var(--border-2)", color: "var(--ink-1)" }}
          >
            Try again
          </button>
        )}
        <span className="text-xs" style={{ color: "var(--ink-3)" }}>
          {submitted
            ? `You scored ${score} out of ${questions.length}.`
            : allAnswered
              ? "Ready to check."
              : "Answer every question to check your score."}
        </span>
        {data.warning ? (
          <span className="text-xs" style={{ color: "var(--warn)" }}>
            {data.warning}
          </span>
        ) : null}
      </footer>
    </ToolShell>
  );
}

function QuizIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
      <path
        d="M7 7.5a3 3 0 115 2.25c-.75.6-1.25 1-1.25 2M10 15h.01"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <circle cx={10} cy={10} r={7.25} stroke="currentColor" strokeWidth={1.6} />
    </svg>
  );
}

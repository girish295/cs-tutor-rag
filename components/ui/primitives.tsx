"use client";

/**
 * Small shared presentational pieces.
 *
 * Extracted because the tool widgets would otherwise repeat the same card
 * chrome, and inconsistency between them is exactly what makes a generative-UI
 * surface feel unfinished.
 */

import type { ReactNode } from "react";

export function cx(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}

/** The card every tool result is rendered inside. */
export function ToolShell({
  icon,
  title,
  subtitle,
  badge,
  children,
  tone = "neutral",
}: {
  icon: ReactNode;
  title: string;
  subtitle?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  tone?: "neutral" | "accent";
}) {
  return (
    <section className="card card-lit animate-in my-3 overflow-hidden">
      <header
        className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5 sm:px-4"
        style={{
          borderColor: "var(--border-1)",
          background: tone === "accent" ? "var(--accent-soft)" : "var(--surface-2)",
        }}
      >
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
          style={{
            color: tone === "accent" ? "var(--accent)" : "var(--ink-2)",
            background: tone === "accent" ? "transparent" : "var(--surface-3)",
          }}
          aria-hidden
        >
          {icon}
        </span>
        <h3
          className="text-[13px] font-semibold tracking-tight"
          style={{ color: "var(--ink-1)" }}
        >
          {title}
        </h3>
        {subtitle ? (
          <span className="min-w-0 text-[11.5px]" style={{ color: "var(--ink-3)" }}>
            {subtitle}
          </span>
        ) : null}
        {badge ? <div className="ml-auto">{badge}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "bad" | "warn" | "accent";
}) {
  const palette = {
    neutral: { bg: "var(--surface-3)", fg: "var(--ink-2)" },
    good: { bg: "var(--good-soft)", fg: "var(--good)" },
    bad: { bg: "var(--bad-soft)", fg: "var(--bad)" },
    warn: { bg: "var(--warn-soft)", fg: "var(--warn)" },
    accent: { bg: "var(--accent-soft)", fg: "var(--accent)" },
  }[tone];

  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: palette.bg, color: palette.fg }}
    >
      {children}
    </span>
  );
}

/** A small secondary button used inside tool card headers. */
export function GhostButton({
  children,
  onClick,
  expanded,
}: {
  children: ReactNode;
  onClick: () => void;
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md px-2 py-1 text-[11px] font-semibold transition-colors hover:brightness-110"
      style={{ background: "var(--surface-3)", color: "var(--ink-2)" }}
      aria-expanded={expanded}
    >
      {children}
    </button>
  );
}

/** The placeholder shown while a tool call is still running. */
export function ToolPending({ label }: { label: string }) {
  return (
    <div
      className="card animate-in my-3 flex items-center gap-2.5 px-3.5 py-2.5"
      style={{ color: "var(--ink-2)" }}
    >
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="typing-dot h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--accent)", animationDelay: `${index * 0.16}s` }}
          />
        ))}
      </span>
      <span className="text-[13.5px]">{label}…</span>
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div
      className="my-2 rounded-[var(--radius)] border px-3 py-2 text-[13.5px]"
      style={{
        borderColor: "var(--bad)",
        background: "var(--bad-soft)",
        color: "var(--bad)",
      }}
      role="alert"
    >
      {children}
    </div>
  );
}

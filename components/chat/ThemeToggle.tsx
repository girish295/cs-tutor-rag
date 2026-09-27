"use client";

/**
 * Light/dark toggle.
 *
 * Three states rather than two: "system" follows the OS, and the explicit
 * choices override it. The chosen value is written to `data-theme` on the root
 * element — the same attribute the inline script in `layout.tsx` sets before
 * first paint to avoid a flash of the wrong theme.
 *
 * The `data-theme` attribute *is* the source of truth, so this reads it through
 * `useSyncExternalStore` rather than mirroring it into React state. That avoids
 * a `setState` inside an effect (which causes a cascading re-render) and gives
 * correct hydration for free: the server snapshot is always "system", and React
 * re-renders with the real value once hydrated.
 */

import { useSyncExternalStore } from "react";

type Theme = "system" | "light" | "dark";
const STORAGE_KEY = "cs-tutor-theme";

const listeners = new Set<() => void>();

/** Notifies subscribers after this tab changes the theme. */
function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // `storage` fires when another tab changes the preference, keeping tabs in sync.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): Theme {
  const attribute = document.documentElement.getAttribute("data-theme");
  return attribute === "dark" || attribute === "light" ? attribute : "system";
}

/** During SSR nothing is known about the viewer's preference. */
function getServerSnapshot(): Theme {
  return "system";
}

function applyTheme(next: Theme): void {
  try {
    if (next === "system") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, next);
    }
  } catch {
    // Storage can be unavailable in private mode; still apply the attribute.
  }

  if (next === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", next);
  }
  emit();
}

const OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "☀" },
  { value: "system", label: "System", icon: "◐" },
  { value: "dark", label: "Dark", icon: "☾" },
];

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div
      className="flex gap-0.5 rounded-lg p-0.5"
      style={{ background: "var(--surface-3)" }}
      role="group"
      aria-label="Colour theme"
    >
      {OPTIONS.map((option) => {
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => applyTheme(option.value)}
            className="flex h-6 w-7 items-center justify-center rounded-md text-[12px] transition-colors"
            style={{
              background: active ? "var(--surface-1)" : "transparent",
              color: active ? "var(--ink-1)" : "var(--ink-3)",
            }}
            aria-pressed={active}
            title={option.label}
          >
            <span aria-hidden>{option.icon}</span>
            <span className="sr-only">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

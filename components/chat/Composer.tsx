"use client";

/**
 * The message composer: text plus image attachments.
 *
 * Images can arrive three ways — the attach button, a clipboard paste, or a drag
 * and drop onto the composer. All three funnel through the same validation, so
 * limits and error messages cannot drift apart.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { cx } from "@/components/ui/primitives";

export interface Attachment {
  id: string;
  filename: string;
  mediaType: string;
  /** Data URL — what gets sent as the file part. */
  url: string;
  size: number;
}

const MAX_IMAGES = 3;
const MAX_BYTES = 8 * 1024 * 1024;
/** Tallest the composer grows before it starts scrolling, in pixels. */
const MAX_HEIGHT = 200;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function Composer({
  onSend,
  onStop,
  busy,
  disabled,
}: {
  onSend: (text: string, attachments: Attachment[]) => void;
  onStop: () => void;
  busy: boolean;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Auto-grow the textarea up to a cap, then let it scroll.
   *
   * Resetting to `auto` before measuring is essential — `scrollHeight` never
   * shrinks below the current height, so without the reset the box only ever
   * grows.
   */
  const resize = useCallback(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, MAX_HEIGHT)}px`;
  }, []);

  useEffect(resize, [text, resize]);

  /**
   * Re-measure after layout and font loading settle.
   *
   * Measuring during hydration produced a textarea stuck at its maximum height:
   * the flex row had not resolved its widths yet, so the placeholder wrapped
   * across dozens of lines and `scrollHeight` came back enormous. Because the
   * measuring effect only re-ran when the text changed, that wrong value was
   * never corrected. A frame later the width is real, and a width change (or a
   * late webfont) can alter the line count too.
   */
  useEffect(() => {
    const frame = requestAnimationFrame(resize);
    window.addEventListener("resize", resize);
    document.fonts?.ready.then(resize).catch(() => {});
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [resize]);

  const addFiles = useCallback(
    async (files: File[]) => {
      const images = files.filter((file) => file.type.startsWith("image/"));
      if (images.length === 0) {
        if (files.length > 0) setNotice("Only image files can be attached.");
        return;
      }

      setNotice(null);
      const accepted: Attachment[] = [];
      const rejected: string[] = [];

      for (const file of images) {
        if (file.size > MAX_BYTES) {
          rejected.push(`${file.name} is ${formatBytes(file.size)} (max 8 MB)`);
          continue;
        }
        try {
          accepted.push({
            id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
            filename: file.name || "pasted-image.png",
            mediaType: file.type,
            url: await readAsDataUrl(file),
            size: file.size,
          });
        } catch {
          rejected.push(`${file.name} could not be read`);
        }
      }

      setAttachments((previous) => {
        const room = MAX_IMAGES - previous.length;
        if (accepted.length > room) {
          rejected.push(`only ${MAX_IMAGES} images per message`);
        }
        return [...previous, ...accepted.slice(0, Math.max(room, 0))];
      });

      if (rejected.length > 0) setNotice(rejected.join("; "));
    },
    [],
  );

  // Clipboard paste. Bound to the textarea so it does not intercept pastes
  // elsewhere on the page.
  const handlePaste = (event: React.ClipboardEvent) => {
    const files = Array.from(event.clipboardData.files);
    if (files.length > 0) {
      event.preventDefault();
      void addFiles(files);
    }
  };

  const submit = () => {
    const trimmed = text.trim();
    if (busy || disabled) return;
    if (!trimmed && attachments.length === 0) return;
    onSend(trimmed, attachments);
    setText("");
    setAttachments([]);
    setNotice(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter inserts a newline. This is the convention every
    // chat interface uses, and violating it is immediately annoying.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void addFiles(Array.from(event.dataTransfer.files));
      }}
      className={cx(
        "rounded-[var(--radius-lg)] border transition-all duration-200",
        "focus-within:border-[var(--accent)]",
        dragging && "border-dashed",
      )}
      style={{
        borderColor: dragging ? "var(--accent)" : "var(--border-2)",
        background: dragging ? "var(--accent-soft)" : "var(--surface-1)",
        boxShadow: "var(--shadow-2)",
      }}
    >
      {attachments.length > 0 ? (
        <div className="flex flex-wrap gap-2 px-2.5 pt-2.5">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="relative overflow-hidden rounded-lg border"
              style={{ borderColor: "var(--border-1)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
              <img
                src={attachment.url}
                alt={attachment.filename}
                className="h-16 w-16 object-cover"
              />
              <button
                type="button"
                onClick={() =>
                  setAttachments((previous) =>
                    previous.filter((item) => item.id !== attachment.id),
                  )
                }
                className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold"
                style={{ background: "var(--surface-1)", color: "var(--ink-1)" }}
                aria-label={`Remove ${attachment.filename}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {notice ? (
        <p className="px-3 pt-2 text-xs" style={{ color: "var(--warn)" }}>
          {notice}
        </p>
      ) : null}

      <div className="flex items-end gap-1.5 p-2.5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            void addFiles(Array.from(event.target.files ?? []));
            // Reset so selecting the same file twice still fires a change event.
            event.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={attachments.length >= MAX_IMAGES || disabled}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-35"
          style={{ color: "var(--ink-2)" }}
          aria-label="Attach an image"
          title={
            attachments.length >= MAX_IMAGES
              ? `Maximum ${MAX_IMAGES} images`
              : "Attach an image"
          }
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden>
            <path
              d="M11.5 5.5l-5 5a2.12 2.12 0 003 3l5-5a3.54 3.54 0 00-5-5l-5.5 5.5a4.95 4.95 0 007 7l4.5-4.5"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          rows={1}
          disabled={disabled}
          placeholder="Ask a question…"
          className="scroll-area flex-1 resize-none bg-transparent py-2 text-[15px] leading-relaxed outline-none placeholder:opacity-55"
          style={{ color: "var(--ink-1)" }}
          aria-label="Message"
        />

        {busy ? (
          <button
            type="button"
            onClick={onStop}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium"
            style={{ background: "var(--surface-3)", color: "var(--ink-1)" }}
          >
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "currentColor" }} />
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={(!text.trim() && attachments.length === 0) || disabled}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all disabled:opacity-30"
            style={{
              background: "var(--accent)",
              color: "var(--accent-ink)",
              boxShadow:
                !text.trim() && attachments.length === 0
                  ? "none"
                  : "0 2px 10px var(--accent-glow)",
            }}
            aria-label="Send message"
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
              <path
                d="M10 16V4M5 9l5-5 5 5"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>

      {/* The full hint does not fit on a phone, so the extras are dropped there
          rather than wrapped onto a second line. */}
      <p className="px-3.5 pb-2.5 text-[10.5px]" style={{ color: "var(--ink-3)" }}>
        <kbd className="font-sans font-medium">Enter</kbd> to send
        <span className="hidden sm:inline">
          {" · "}
          <kbd className="font-sans font-medium">Shift+Enter</kbd> for a new line ·
          paste or drop an image
        </span>
      </p>
    </div>
  );
}

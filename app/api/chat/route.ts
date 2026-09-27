/**
 * The chat endpoint.
 *
 * Responsibilities, in order: validate the request, decide whether the turn
 * needs the vision model, and then either stream a real Groq response with the
 * full tool set, or — when no API key is configured — stream the demo response.
 */

import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { createGroq } from "@ai-sdk/groq";

import { LIMITS, MODEL_ALTERNATES, getMode, resolveModelIds } from "@/lib/config";
import { buildSystemPrompt } from "@/lib/prompt";
import { createDemoStream } from "@/lib/demo/demo-stream";
import { tools } from "@/lib/tools";

/**
 * The retrieval layer reads the markdown corpus from disk, so this route must
 * run on the Node runtime rather than the edge.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatRequestBody {
  messages?: UIMessage[];
  /** Optional topic filter chosen in the UI sidebar. */
  topic?: string;
}

function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

/** Concatenated text of a message's text parts. */
function textOf(message: UIMessage | undefined): string {
  if (!message) return "";
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join(" ")
    .trim();
}

/** Image file parts attached to a message. */
function imagePartsOf(message: UIMessage | undefined) {
  if (!message) return [];
  return message.parts.filter(
    (part): part is { type: "file"; url: string; mediaType: string } =>
      part.type === "file" &&
      typeof (part as { mediaType?: unknown }).mediaType === "string" &&
      (part as { mediaType: string }).mediaType.startsWith("image/"),
  );
}

/**
 * Approximate decoded size of a data URL, from its base64 length. Used to
 * reject oversized uploads before they are forwarded to the provider, which
 * would otherwise fail with an opaque 413 well after the user has waited.
 */
function dataUrlBytes(url: string): number {
  const commaIndex = url.indexOf(",");
  if (!url.startsWith("data:") || commaIndex === -1) return 0;
  const base64Length = url.length - commaIndex - 1;
  return Math.floor((base64Length * 3) / 4);
}

export async function POST(request: Request) {
  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return badRequest("`messages` must be a non-empty array.");
  }
  if (messages.some((message) => !message || !Array.isArray(message.parts))) {
    return badRequest("Every message must have a `parts` array.");
  }

  // Keep only the most recent turns. An unbounded history would eventually
  // exceed the model's context window and fail the request outright.
  const trimmed = messages.slice(-LIMITS.maxMessages);
  const latest = trimmed[trimmed.length - 1];

  const images = imagePartsOf(latest);
  if (images.length > LIMITS.maxImagesPerRequest) {
    return badRequest(
      `At most ${LIMITS.maxImagesPerRequest} images can be sent in one message.`,
    );
  }
  for (const image of images) {
    const bytes = dataUrlBytes(image.url);
    if (bytes > LIMITS.maxImageBytes) {
      return badRequest(
        `Each image must be under ${Math.round(LIMITS.maxImageBytes / (1024 * 1024))}MB.`,
      );
    }
  }

  const topic = typeof body.topic === "string" && body.topic ? body.topic : undefined;

  // --- Demo mode ------------------------------------------------------------
  if (getMode() === "demo") {
    return createUIMessageStreamResponse({
      stream: createDemoStream({
        userText: textOf(latest),
        imageCount: images.length,
        topic,
      }),
    });
  }

  // --- Live mode ------------------------------------------------------------
  const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! });
  const modelIds = resolveModelIds();
  // Route to the vision model only when this turn actually carries an image;
  // text turns stay on the stronger text/tool-calling model.
  const usingVision = images.length > 0;
  const modelId = usingVision ? modelIds.vision : modelIds.text;

  let modelMessages;
  try {
    modelMessages = await convertToModelMessages(trimmed, { tools });
  } catch (error) {
    return badRequest(
      `Could not convert the conversation: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const result = streamText({
    model: groq(modelId),
    system: buildSystemPrompt({ hasImages: usingVision }),
    messages: modelMessages,
    tools,
    // Bounds the agentic loop: the model may search, then search again, then
    // build a widget, then answer — but it cannot loop indefinitely.
    stopWhen: stepCountIs(LIMITS.maxSteps),
    temperature: 0.3,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      tools,
      onError: (error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[chat] stream error:", message);

        // A retired or renamed model id is by far the most likely failure in a
        // project like this, so it gets an actionable message rather than a
        // generic one.
        if (/model|decommission|not found|does not exist|404/i.test(message)) {
          const alternates = usingVision
            ? MODEL_ALTERNATES.vision
            : MODEL_ALTERNATES.text;
          return (
            `The model "${modelId}" was rejected by Groq. Model IDs change as ` +
            `models are retired. Run \`npm run models\` to list what your key can ` +
            `reach, then set ${usingVision ? "GROQ_VISION_MODEL" : "GROQ_TEXT_MODEL"}. ` +
            `Alternatives to try: ${alternates.join(", ")}. (Original error: ${message})`
          );
        }
        if (/rate.?limit|429|quota/i.test(message)) {
          return "Groq rate limit reached. Wait a moment and try again.";
        }
        if (/api.?key|401|unauthor/i.test(message)) {
          return "Groq rejected the API key. Check GROQ_API_KEY in .env.local.";
        }
        return `Something went wrong: ${message}`;
      },
    }),
  });
}

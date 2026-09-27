/**
 * Health and configuration endpoint.
 *
 * Useful both as a deployment smoke test (does the corpus load inside the
 * serverless bundle?) and as the source for the UI's status panel.
 */

import { getCapabilities } from "@/lib/config";
import { corpusStats } from "@/lib/rag";
import { TOOL_LABELS } from "@/lib/tools";

export const runtime = "nodejs";

export async function GET() {
  try {
    const stats = corpusStats();
    return Response.json({
      status: "ok",
      ...getCapabilities(),
      corpus: stats,
      tools: Object.keys(TOOL_LABELS),
    });
  } catch (error) {
    // A failure here almost always means the corpus files were not traced into
    // the deployment bundle, so say that explicitly.
    return Response.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        hint:
          "The knowledge base could not be loaded. On Vercel this usually means " +
          "lib/rag/corpus was not included in the function bundle — check " +
          "outputFileTracingIncludes in next.config.ts.",
      },
      { status: 500 },
    );
  }
}

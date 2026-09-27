/**
 * Shared chat types.
 *
 * `AppTools` is imported as a *type only* so that nothing from `lib/tools`
 * (which reaches into the filesystem via the retrieval layer) is pulled into the
 * client bundle. The `import type` form is erased at compile time.
 */

import type { InferUITools, UIDataTypes, UIMessage } from "ai";
import type { AppTools } from "@/lib/tools";

export type ChatTools = InferUITools<AppTools>;

/** The message shape shared by the route, the hook and every renderer. */
export type ChatMessage = UIMessage<never, UIDataTypes, ChatTools>;

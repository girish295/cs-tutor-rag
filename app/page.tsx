/**
 * The single page.
 *
 * A server component so the corpus statistics are read on the server — the
 * client needs no extra round trip to know what the knowledge base contains.
 */

import { Chat } from "@/components/chat/Chat";
import { corpusStats } from "@/lib/rag";

// The knowledge base is bundled at build time, but the page still renders per
// request so a regenerated corpus is picked up without a rebuild of the page.
export const dynamic = "force-dynamic";

export default function Page() {
  return <Chat corpus={corpusStats()} />;
}

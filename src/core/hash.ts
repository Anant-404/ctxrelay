import { createHash } from "node:crypto";

/** First 8 hex chars of the sha1 of the given content. */
export function shortHash(content: string): string {
  return createHash("sha1").update(content, "utf8").digest("hex").slice(0, 8);
}

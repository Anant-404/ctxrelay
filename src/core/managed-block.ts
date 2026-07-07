import { MANAGED_BEGIN, MANAGED_END } from "../templates/index.js";

/**
 * Insert or replace the managed block inside an existing document, preserving
 * everything the user added outside the markers. Idempotent: running twice
 * produces identical output.
 */
export function mergeManagedBlock(existing: string, block: string): string {
  const beginIdx = existing.indexOf(MANAGED_BEGIN);
  const endIdx = existing.indexOf(MANAGED_END);

  if (beginIdx !== -1 && endIdx !== -1 && endIdx > beginIdx) {
    const before = existing.slice(0, beginIdx);
    const after = existing.slice(endIdx + MANAGED_END.length);
    return before + block + after;
  }

  // No managed block yet: append it, separated by a blank line.
  const trimmed = existing.replace(/\s+$/, "");
  return trimmed.length > 0 ? `${trimmed}\n\n${block}\n` : `${block}\n`;
}

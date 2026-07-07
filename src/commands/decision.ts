import pc from "picocolors";
import { requireProject } from "../core/paths.js";
import { fileExists, readText, writeText } from "../core/store.js";
import { decisionsTemplate } from "../templates/index.js";

/** Append a dated decision entry to the top of the log (newest first). */
export async function runDecision(text: string): Promise<void> {
  const paths = requireProject();
  const date = new Date().toISOString().slice(0, 10);

  const title = text.length > 60 ? text.slice(0, 57).trimEnd() + "…" : text;
  const entry = `## ${date} — ${title}\n\n${text}\n`;

  let content = fileExists(paths.decisions) ? readText(paths.decisions) : decisionsTemplate();

  // Insert after the header preamble, before the first existing entry.
  const firstEntry = content.search(/\n##\s/);
  if (firstEntry === -1) {
    content = content.replace(/\s*$/, "") + "\n\n" + entry;
  } else {
    content = content.slice(0, firstEntry + 1) + "\n" + entry + content.slice(firstEntry + 1);
  }

  writeText(paths.decisions, content.endsWith("\n") ? content : content + "\n");
  console.log(pc.green("✓ decision logged"));
}

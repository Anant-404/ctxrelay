import { statSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import pc from "picocolors";
import { requireProject, type ProjectPaths } from "../core/paths.js";
import {
  fileExists,
  readConfig,
  readMarkdown,
  writeMarkdown,
} from "../core/store.js";

export interface HandoffOptions {
  from?: string;
  stopped?: string;
  next?: string;
  gotchas?: string;
  files?: string;
}

function handoffBody(o: Required<HandoffOptions>): string {
  return `# Handoff

**Where I stopped:** ${o.stopped || "…"}

**What to do next:** ${o.next || "…"}

**Gotchas / watch out for:** ${o.gotchas || "…"}

**Files I touched:** ${o.files || "…"}
`;
}

function updateState(paths: ProjectPaths, agent: string, now: string): void {
  if (!fileExists(paths.state)) return;
  const doc = readMarkdown(paths.state);
  doc.data.updated = now;
  doc.data.lastAgent = agent;
  writeMarkdown(paths.state, doc);
}

/** Warn if index.json is older than the newest source file. */
function checkIndexFreshness(paths: ProjectPaths): void {
  if (!fileExists(paths.index)) {
    console.error(pc.yellow("note: no index.json yet — run `ctxrelay index`"));
    return;
  }
  try {
    const indexMtime = statSync(paths.index).mtimeMs;
    // Cheap heuristic: compare against package.json / src dir mtime.
    const candidates = ["src", "app", "pages", "lib"].map((d) => join(paths.root, d));
    let newest = 0;
    for (const c of candidates) {
      if (fileExists(c)) newest = Math.max(newest, statSync(c).mtimeMs);
    }
    if (newest > indexMtime) {
      console.error(pc.yellow("note: source changed since last index — run `ctxrelay index`"));
    }
  } catch {
    /* ignore */
  }
}

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

export async function runHandoff(opts: HandoffOptions): Promise<void> {
  const paths = requireProject();
  const config = readConfig(paths);
  const now = new Date().toISOString();

  const anyFlag = !!(opts.from || opts.stopped || opts.next || opts.gotchas || opts.files);

  let filled: Required<HandoffOptions> = {
    from: opts.from || config.agentName || "unknown",
    stopped: opts.stopped || "",
    next: opts.next || "",
    gotchas: opts.gotchas || "",
    files: opts.files || "",
  };

  if (!anyFlag) {
    if (!process.stdin.isTTY) {
      throw new Error(
        "handoff requires flags in non-interactive mode: --from --stopped --next [--gotchas] [--files]"
      );
    }
    console.log(pc.bold("Writing handoff — fill in each field:"));
    filled = {
      from: (await prompt("Your name: ")) || filled.from,
      stopped: await prompt("Where you stopped: "),
      next: await prompt("What to do next: "),
      gotchas: await prompt("Gotchas (optional): "),
      files: await prompt("Files touched (optional): "),
    };
  }

  writeMarkdown(paths.handoff, {
    data: { updated: now, fromAgent: filled.from },
    body: handoffBody(filled),
  });
  updateState(paths, filled.from, now);

  console.log(pc.green("✓ handoff written") + pc.dim(` (from ${filled.from})`));
  checkIndexFreshness(paths);
}

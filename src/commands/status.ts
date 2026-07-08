import { readFileSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import { requireProject, type ProjectPaths } from "../core/paths.js";
import { fileExists, readConfig, readIndex, readMarkdown } from "../core/store.js";
import { walkFiles } from "../core/walk.js";
import { shortHash } from "../core/hash.js";

function section(title: string, content: string): string {
  return content.trim() ? `${pc.bold(title)}\n${content.trim()}\n` : "";
}

async function changedSinceIndex(paths: ProjectPaths): Promise<number> {
  const index = readIndex(paths);
  if (!index) return -1;
  const config = readConfig(paths);
  const byPath = new Map(index.files.map((f) => [f.path, f.hash]));
  const { files } = await walkFiles(paths.root, config);
  let changed = 0;
  for (const rel of files) {
    try {
      const src = readFileSync(join(paths.root, rel), "utf8");
      if (byPath.get(rel) !== shortHash(src)) changed++;
    } catch {
      /* ignore */
    }
  }
  // deleted files also count
  for (const p of byPath.keys()) if (!files.includes(p)) changed++;
  return changed;
}

export async function runStatus(): Promise<void> {
  const paths = requireProject();

  if (!fileExists(paths.state) && !fileExists(paths.handoff)) {
    console.log(pc.yellow("No .aicontext yet. Run `ctxrelay init`."));
    return;
  }

  const out: string[] = [];

  if (fileExists(paths.state)) {
    const s = readMarkdown(paths.state);
    const meta = `updated ${s.data.updated ?? "?"} · lastAgent ${s.data.lastAgent ?? "?"} · phase ${s.data.phase ?? "?"}`;
    out.push(section("State", pc.dim(meta) + "\n" + s.body));
  }

  if (fileExists(paths.handoff)) {
    const h = readMarkdown(paths.handoff);
    const firstLines = h.body
      .split("\n")
      .filter((l) => l.trim())
      .slice(0, 6)
      .join("\n");
    out.push(section("Last handoff", firstLines));
  }

  const changed = await changedSinceIndex(paths);
  if (changed === -1) {
    out.push(section("Index", pc.yellow("no index yet — run `ctxrelay index`")));
  } else {
    const msg =
      changed === 0
        ? pc.green("up to date")
        : pc.yellow(`${changed} file(s) changed since last index — run \`ctxrelay index\``);
    out.push(section("Index", msg));
  }

  process.stdout.write(out.filter(Boolean).join("\n") + "\n");
}

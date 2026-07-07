import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface ProjectPaths {
  root: string;
  aicontext: string;
  state: string;
  plan: string;
  decisions: string;
  handoff: string;
  index: string;
  config: string;
  tasks: string;
  tasksMd: string;
  enrichRequest: string;
  enrichResponse: string;
}

/**
 * Walk up from `start` looking for a `.git` dir or `package.json`.
 * Returns the first directory that has either, or null if none found.
 */
export function findRepoRoot(start: string = process.cwd()): string | null {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, ".git")) || existsSync(join(dir, "package.json"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function resolvePaths(root: string): ProjectPaths {
  const aicontext = join(root, ".aicontext");
  return {
    root,
    aicontext,
    state: join(aicontext, "STATE.md"),
    plan: join(aicontext, "PLAN.md"),
    decisions: join(aicontext, "DECISIONS.md"),
    handoff: join(aicontext, "HANDOFF.md"),
    index: join(aicontext, "index.json"),
    config: join(aicontext, "config.json"),
    tasks: join(aicontext, "tasks.json"),
    tasksMd: join(aicontext, "TASKS.md"),
    enrichRequest: join(aicontext, "enrich-request.md"),
    enrichResponse: join(aicontext, "enrich-response.json"),
  };
}

/**
 * Locate the project and its `.aicontext` paths, or throw a clear error.
 */
export function requireProject(start: string = process.cwd()): ProjectPaths {
  const root = findRepoRoot(start);
  if (!root) {
    throw new Error(
      "Not inside a project. Run this from a directory containing a .git folder or package.json."
    );
  }
  return resolvePaths(root);
}

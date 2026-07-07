import fg from "fast-glob";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { AbConfig } from "./store.js";

/**
 * Convert a .gitignore file into fast-glob ignore patterns. Handles the common
 * cases (bare names, trailing-slash dirs, globs, rooted paths); negation and
 * exotic patterns are skipped — the built-in ignore list covers the essentials.
 */
function gitignorePatterns(root: string): string[] {
  const file = join(root, ".gitignore");
  if (!existsSync(file)) return [];
  const out: string[] = [];
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("!")) continue;
    const rooted = line.startsWith("/");
    const clean = line.replace(/^\//, "").replace(/\/$/, "");
    if (!clean) continue;
    if (clean.includes("*")) {
      out.push(rooted ? clean : `**/${clean}`);
    } else {
      // treat as file-or-dir name
      out.push(rooted ? `${clean}/**` : `**/${clean}/**`);
      out.push(rooted ? clean : `**/${clean}`);
    }
  }
  return out;
}

/** Directories never walked. */
const IGNORE_DIRS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "out",
  "coverage",
  ".aicontext",
  ".turbo",
  ".cache",
  ".vercel",
];

/** Glob patterns excluded regardless of extension. */
const IGNORE_GLOBS = [
  "**/*.min.*",
  "**/*.d.ts",
  "**/*.map",
  "**/package-lock.json",
  "**/pnpm-lock.yaml",
  "**/yarn.lock",
  "**/bun.lockb",
];

/** Code extensions routed through the AST/base extractors. */
export const CODE_EXTS = ["ts", "tsx", "js", "jsx", "mjs", "cjs"];

/** Extra files routed to specialized extractors. */
const SPECIAL_GLOBS = [
  "**/*.prisma",
  "**/*.sql",
];

export interface WalkResult {
  /** Repo-relative paths, forward slashes, sorted. */
  files: string[];
}

/**
 * Enumerate source files under `root`, honoring built-in ignores, .gitignore,
 * and any user `ignore` globs from config.json.
 */
export async function walkFiles(root: string, config: AbConfig): Promise<WalkResult> {
  const codeGlobs = CODE_EXTS.map((ext) => `**/*.${ext}`);
  const patterns = [...codeGlobs, ...SPECIAL_GLOBS];

  const entries = await fg(patterns, {
    cwd: root,
    absolute: false,
    onlyFiles: true,
    dot: false,
    followSymbolicLinks: false,
    ignore: [
      ...IGNORE_DIRS.map((d) => `**/${d}/**`),
      ...IGNORE_GLOBS,
      ...gitignorePatterns(root),
      ...(config.ignore ?? []),
    ],
  });

  const files = entries
    .map((e) => e.split("\\").join("/"))
    .sort((a, b) => a.localeCompare(b));

  return { files };
}

export function toRel(root: string, abs: string): string {
  return relative(root, abs).split("\\").join("/");
}

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import matter from "gray-matter";
import type { CodebaseIndex } from "../schema/index-schema.js";
import { isValidIndex } from "../schema/index-schema.js";
import type { ProjectPaths } from "./paths.js";

export interface AbConfig {
  contextBudget?: number;
  ignore?: string[];
  extractors?: Record<string, boolean>;
  decisionsInContext?: number;
  agentName?: string;
}

export const DEFAULT_CONFIG: Required<Pick<AbConfig, "contextBudget" | "decisionsInContext">> = {
  contextBudget: 2000,
  decisionsInContext: 5,
};

export interface MarkdownDoc {
  data: Record<string, unknown>;
  body: string;
}

function ensureDir(file: string): void {
  const dir = dirname(file);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function fileExists(path: string): boolean {
  return existsSync(path);
}

export function readText(path: string): string {
  return readFileSync(path, "utf8");
}

export function writeText(path: string, content: string): void {
  ensureDir(path);
  writeFileSync(path, content, "utf8");
}

/** Parse a markdown file with YAML frontmatter. */
export function readMarkdown(path: string): MarkdownDoc {
  const raw = readFileSync(path, "utf8");
  const parsed = matter(raw);
  return { data: parsed.data ?? {}, body: parsed.content ?? "" };
}

/** Serialize frontmatter + body back to disk (stable formatting). */
export function writeMarkdown(path: string, doc: MarkdownDoc): void {
  ensureDir(path);
  const out = matter.stringify(doc.body.replace(/^\n+/, ""), doc.data);
  writeFileSync(path, out.endsWith("\n") ? out : out + "\n", "utf8");
}

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

/** Pretty JSON with 2-space indent + trailing newline (clean git diffs). */
export function writeJson(path: string, value: unknown): void {
  ensureDir(path);
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

export function readConfig(paths: ProjectPaths): AbConfig {
  if (!existsSync(paths.config)) return {};
  try {
    return readJson<AbConfig>(paths.config);
  } catch {
    return {};
  }
}

export function readIndex(paths: ProjectPaths): CodebaseIndex | null {
  if (!existsSync(paths.index)) return null;
  try {
    const value = readJson<unknown>(paths.index);
    return isValidIndex(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeIndex(paths: ProjectPaths, index: CodebaseIndex): void {
  writeJson(paths.index, index);
}

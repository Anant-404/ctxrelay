import type {
  ComponentEntry,
  ExportEntry,
  MongoCollection,
  PostgresTable,
  PrismaModel,
  RouteEntry,
} from "../schema/index-schema.js";

export interface FileMeta {
  /** repo-relative path, forward slashes */
  path: string;
  /** file extension without dot, e.g. "ts", "prisma", "sql" */
  ext: string;
  lang: string;
}

export interface ExtractCtx {
  file: FileMeta;
  source: string;
  stack: string[];
  /** repo root absolute path */
  root: string;
}

/** What an extractor may contribute to the shared index. */
export interface IndexContribution {
  exports: ExportEntry[];
  imports: string[];
  routes: RouteEntry[];
  components: ComponentEntry[];
  postgres: PostgresTable[];
  prisma: PrismaModel[];
  mongo: MongoCollection[];
}

export function emptyContribution(): IndexContribution {
  return {
    exports: [],
    imports: [],
    routes: [],
    components: [],
    postgres: [],
    prisma: [],
    mongo: [],
  };
}

export interface Extractor {
  name: string;
  appliesTo(file: FileMeta, stack: string[]): boolean;
  extract(ctx: ExtractCtx): Partial<IndexContribution>;
}

/** Strip comments crudely so regex extractors don't match commented code. */
export function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const NODE_BUILTINS = new Set([
  "fs",
  "path",
  "os",
  "crypto",
  "http",
  "https",
  "url",
  "util",
  "events",
  "stream",
  "child_process",
  "process",
  "buffer",
  "zlib",
  "net",
  "assert",
]);

/** Dedupe + cap import specifiers; drop node builtins and relative noise depth. */
export function normalizeImports(specs: string[], cap = 15): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of specs) {
    const s = raw.replace(/^node:/, "");
    if (NODE_BUILTINS.has(s)) continue;
    if (seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
    if (out.length >= cap) break;
  }
  return out;
}

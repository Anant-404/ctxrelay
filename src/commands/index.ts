import { readFileSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import { requireProject, type ProjectPaths } from "../core/paths.js";
import { detectStack } from "../core/stack-detect.js";
import { readConfig, readIndex, writeIndex } from "../core/store.js";
import { walkFiles } from "../core/walk.js";
import { shortHash } from "../core/hash.js";
import { activeExtractors } from "../extractors/registry.js";
import { emptyContribution, type FileMeta } from "../extractors/types.js";
import {
  emptyIndex,
  type CodebaseIndex,
  type ComponentEntry,
  type FileEntry,
  type RouteEntry,
} from "../schema/index-schema.js";

export interface IndexOptions {
  watch?: boolean;
  verbose?: boolean;
  silent?: boolean;
}

export interface IndexResult {
  totalFiles: number;
  indexedFiles: number;
  parsed: number;
  reused: number;
  errors: number;
}

const LANG_BY_EXT: Record<string, string> = {
  ts: "ts",
  tsx: "tsx",
  js: "js",
  jsx: "jsx",
  mjs: "js",
  cjs: "js",
  prisma: "prisma",
  sql: "sql",
};

function extOf(path: string): string {
  const i = path.lastIndexOf(".");
  return i === -1 ? "" : path.slice(i + 1).toLowerCase();
}

function dedupeRoutes(routes: RouteEntry[]): RouteEntry[] {
  const seen = new Set<string>();
  const out: RouteEntry[] = [];
  for (const r of routes) {
    const key = `${r.framework}|${r.method}|${r.path}|${r.file}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out.sort(
    (a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method)
  );
}

function dedupeComponents(components: ComponentEntry[]): ComponentEntry[] {
  const seen = new Set<string>();
  const out: ComponentEntry[] = [];
  for (const c of components) {
    const key = `${c.name}|${c.file}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

async function buildIndex(
  paths: ProjectPaths,
  verbose: boolean
): Promise<{ index: CodebaseIndex; result: IndexResult }> {
  const config = readConfig(paths);
  const { stack, projectName } = detectStack(paths.root);
  const { files: relFiles } = await walkFiles(paths.root, config);
  const extractors = activeExtractors(config);

  const prev = readIndex(paths);
  const prevByPath = new Map<string, FileEntry>();
  if (prev) for (const f of prev.files) prevByPath.set(f.path, f);

  const index = emptyIndex(projectName);
  index.stack = stack;

  let parsed = 0;
  let reused = 0;
  let errors = 0;
  let loc = 0;

  const routes: RouteEntry[] = [];
  const components: ComponentEntry[] = [];
  const fileEntries: FileEntry[] = [];

  for (const rel of relFiles) {
    const abs = join(paths.root, rel);
    let source: string;
    try {
      source = readFileSync(abs, "utf8");
    } catch {
      errors++;
      continue;
    }
    loc += source.length === 0 ? 0 : source.split("\n").length;
    const hash = shortHash(source);
    const ext = extOf(rel);
    const lang = LANG_BY_EXT[ext] ?? ext;

    const existing = prevByPath.get(rel);
    if (existing && existing.hash === hash) {
      // Reuse file entry (including cached purpose). Still re-run extractors
      // that contribute to the shared route/component/db collections is
      // unnecessary — those are regenerated below from a cached scan. To keep
      // routes/components deterministic we re-run extractors regardless; but
      // exports/imports/purpose are reused. Cheap because extraction is regex.
    }

    const meta: FileMeta = { path: rel, ext, lang };
    const merged = emptyContribution();

    for (const ex of extractors) {
      if (!ex.appliesTo(meta, stack)) continue;
      try {
        const c = ex.extract({ file: meta, source, stack, root: paths.root });
        if (c.exports) merged.exports.push(...c.exports);
        if (c.imports) merged.imports.push(...c.imports);
        if (c.routes) routes.push(...c.routes);
        if (c.components) components.push(...c.components);
        if (c.postgres) index.db.postgres.push(...c.postgres);
        if (c.prisma) index.db.prisma.push(...c.prisma);
        if (c.mongo) index.db.mongo.push(...c.mongo);
      } catch {
        errors++;
      }
    }

    if (existing && existing.hash === hash) {
      reused++;
      fileEntries.push({
        ...existing,
        // structural fields are always regenerated deterministically
        lang,
        exports: dedupeExports(merged.exports),
        imports: merged.imports,
      });
    } else {
      parsed++;
      fileEntries.push({
        path: rel,
        hash,
        lang,
        purpose: existing?.purpose ?? null,
        purposeStale: existing ? existing.purpose !== null : false,
        exports: dedupeExports(merged.exports),
        imports: merged.imports,
      });
    }
  }

  index.files = fileEntries.sort((a, b) => a.path.localeCompare(b.path));
  index.routes = dedupeRoutes(routes);
  index.components = dedupeComponents(components);
  index.db.prisma.sort((a, b) => a.model.localeCompare(b.model));
  index.db.postgres.sort((a, b) => a.table.localeCompare(b.table));
  index.db.mongo.sort((a, b) => a.collection.localeCompare(b.collection));

  const indexedFiles = fileEntries.length;
  index.stats = { files: relFiles.length, indexedFiles, loc };

  if (verbose) {
    console.error(pc.dim(`parsed=${parsed} reused=${reused} errors=${errors}`));
  }

  return {
    index,
    result: { totalFiles: relFiles.length, indexedFiles, parsed, reused, errors },
  };
}

function dedupeExports(
  exports: FileEntry["exports"]
): FileEntry["exports"] {
  const seen = new Set<string>();
  const out: FileEntry["exports"] = [];
  for (const e of exports) {
    const key = `${e.name}:${e.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

export async function runIndex(opts: IndexOptions = {}): Promise<IndexResult> {
  const paths = requireProject();
  const { index, result } = await buildIndex(paths, !!opts.verbose);
  writeIndex(paths, index);

  if (!opts.silent) {
    console.log(
      pc.green("✓ indexed ") +
        `${result.indexedFiles} files` +
        (result.errors ? pc.yellow(` (${result.errors} skipped)`) : "")
    );
  }

  if (opts.watch) {
    await watchLoop(paths, opts);
  }
  return result;
}

async function watchLoop(paths: ProjectPaths, opts: IndexOptions): Promise<void> {
  const { watch } = await import("node:fs");
  console.log(pc.dim("watching for changes… (ctrl-c to stop)"));
  let timer: NodeJS.Timeout | null = null;
  const debounced = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const { index, result } = await buildIndex(paths, false);
        writeIndex(paths, index);
        console.log(pc.dim(`re-indexed ${result.indexedFiles} files`));
      } catch {
        /* ignore transient errors during rapid edits */
      }
    }, 250);
  };
  try {
    watch(paths.root, { recursive: true }, (_evt, file) => {
      if (!file) return;
      const f = file.toString();
      if (f.includes("node_modules") || f.includes(".aicontext") || f.includes(".git")) return;
      debounced();
    });
  } catch {
    console.error(pc.yellow("recursive watch not supported on this platform; watch disabled"));
    return;
  }
  // Keep process alive.
  void opts;
  await new Promise(() => {});
}

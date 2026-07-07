import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * web-tree-sitter loader. Initializes once and caches the Parser + loaded
 * Language objects. WASM grammar files ship in `src/wasm/` and are located
 * relative to the compiled file (works regardless of the user's CWD).
 *
 * If the runtime or a grammar cannot be loaded, every function degrades to
 * returning null so callers fall back to regex extraction — the indexer is
 * best-effort by design and must never crash.
 */

type TSParser = any;
type TSLanguage = any;
type TSTree = any;
export type { TSTree };

let initPromise: Promise<TSParser | null> | null = null;
const languages = new Map<string, TSLanguage | null>();

function wasmDir(): string {
  // dist/cli.js → package root → src/wasm
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "..", "src", "wasm"), // dist/ -> ../src/wasm
    join(here, "wasm"), // co-located (dev)
    join(here, "..", "wasm"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0];
}

async function getParser(): Promise<TSParser | null> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const mod: any = await import("web-tree-sitter");
      const TS = mod.default ?? mod;
      const runtimeWasm = join(wasmDir(), "tree-sitter.wasm");
      await TS.init({
        locateFile: (name: string) =>
          name === "tree-sitter.wasm" && existsSync(runtimeWasm)
            ? runtimeWasm
            : join(wasmDir(), name),
      });
      return new TS.Parser();
    } catch {
      return null;
    }
  })();
  return initPromise;
}

const GRAMMAR_FILES: Record<string, string> = {
  ts: "tree-sitter-typescript.wasm",
  tsx: "tree-sitter-tsx.wasm",
  js: "tree-sitter-javascript.wasm",
  jsx: "tree-sitter-javascript.wasm",
  mjs: "tree-sitter-javascript.wasm",
  cjs: "tree-sitter-javascript.wasm",
};

async function loadLanguage(lang: string): Promise<TSLanguage | null> {
  if (languages.has(lang)) return languages.get(lang) ?? null;
  const file = GRAMMAR_FILES[lang];
  let result: TSLanguage | null = null;
  try {
    const path = join(wasmDir(), file);
    if (existsSync(path)) {
      const mod: any = await import("web-tree-sitter");
      const TS = mod.default ?? mod;
      const LanguageClass = TS.Language ?? TS.Parser?.Language;
      result = await LanguageClass.load(path);
    }
  } catch {
    result = null;
  }
  languages.set(lang, result);
  return result;
}

/** Parse a file into a tree, or null if AST parsing is unavailable. */
export async function parseFile(lang: string, source: string): Promise<TSTree | null> {
  const parser = await getParser();
  if (!parser) return null;
  const language = await loadLanguage(lang);
  if (!language) return null;
  try {
    parser.setLanguage(language);
    return parser.parse(source);
  } catch {
    return null;
  }
}

/** Whether AST parsing is available at all (for --verbose reporting). */
export async function astAvailable(): Promise<boolean> {
  return (await getParser()) !== null;
}

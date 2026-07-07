// Copy the web-tree-sitter runtime wasm into src/wasm so it ships in the
// package and can be located relative to the compiled CLI at runtime.
// Grammar .wasm files (tree-sitter-*.wasm) are committed to src/wasm directly.
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wasmDir = join(root, "src", "wasm");
if (!existsSync(wasmDir)) mkdirSync(wasmDir, { recursive: true });

function tryCopy(fromCandidates, destName) {
  for (const c of fromCandidates) {
    if (c && existsSync(c)) {
      copyFileSync(c, join(wasmDir, destName));
      console.log(`copied ${destName}`);
      return true;
    }
  }
  console.warn(`warn: could not locate ${destName} (AST parsing will fall back to regex)`);
  return false;
}

// web-tree-sitter ships tree-sitter.wasm next to its entry.
let wtsDir = null;
try {
  wtsDir = dirname(require.resolve("web-tree-sitter"));
} catch {
  /* not installed yet */
}

tryCopy(
  [
    wtsDir && join(wtsDir, "tree-sitter.wasm"),
    wtsDir && join(wtsDir, "..", "tree-sitter.wasm"),
  ],
  "tree-sitter.wasm"
);

// Grammar wasms. Sourced from tree-sitter-wasms at build time and committed to
// src/wasm so no build-machine toolchain is ever needed by consumers.
let grammarDir = null;
try {
  grammarDir = join(dirname(require.resolve("tree-sitter-wasms/package.json")), "out");
} catch {
  /* not installed; committed copies (if any) are used */
}
for (const g of [
  "tree-sitter-javascript.wasm",
  "tree-sitter-typescript.wasm",
  "tree-sitter-tsx.wasm",
]) {
  tryCopy([grammarDir && join(grammarDir, g)], g);
}

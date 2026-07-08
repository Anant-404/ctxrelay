# Bundled WASM grammars

These files let `ctxbridge` parse code with tree-sitter **without any native
build step** on the user's machine. They are committed to the repo so no
compiler/toolchain is ever required to install or run the CLI.

| File | Source | License |
| --- | --- | --- |
| `tree-sitter.wasm` | [`web-tree-sitter`](https://github.com/tree-sitter/tree-sitter) runtime | MIT |
| `tree-sitter-javascript.wasm` | [`tree-sitter-javascript`](https://github.com/tree-sitter/tree-sitter-javascript) | MIT |
| `tree-sitter-typescript.wasm` | [`tree-sitter-typescript`](https://github.com/tree-sitter/tree-sitter-typescript) | MIT |
| `tree-sitter-tsx.wasm` | [`tree-sitter-typescript`](https://github.com/tree-sitter/tree-sitter-typescript) (tsx) | MIT |

The runtime `tree-sitter.wasm` is refreshed from the installed `web-tree-sitter`
package by `scripts/copy-wasm.mjs` at build time. The grammar `.wasm` files are
sourced once from the `tree-sitter-wasms` dev dependency and committed here.

## Adding a new grammar

1. If a prebuilt `.wasm` exists (e.g. via `tree-sitter-wasms`), copy it here.
2. Otherwise generate one once with `npx tree-sitter build --wasm` and commit
   the result. Consumers never run this — the binary ships in the package.
3. Register the file in `src/extractors/parser.ts` (`GRAMMAR_FILES`).
4. Note its license in the table above.

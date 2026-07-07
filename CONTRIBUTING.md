# Contributing to agentbridge

Thanks for helping! The highest-leverage contribution is **adding an extractor** so
another framework's routes / models / components show up in the codebase map.

## Setup

```bash
npm install
npm run build     # tsup bundle + copy wasm
npm test          # vitest
npm run typecheck
npm run lint
```

## The `Extractor` interface

Every extractor is a small object (`src/extractors/*.ts`) that inspects one file and
contributes to the shared index. It must be pure and deterministic — the same input
always yields the same output, so `index.json` diffs stay clean.

```ts
interface Extractor {
  name: string;
  appliesTo(file: FileMeta, stack: string[]): boolean;
  extract(ctx: ExtractCtx): Partial<IndexContribution>;
}
```

`IndexContribution` has `exports`, `imports`, `routes`, `components`, `postgres`,
`prisma`, and `mongo`. Return only the parts you populate.

### Example: a 30-line Fastify route extractor

```ts
import { emptyContribution, stripComments, type Extractor } from "./types.js";

const VERB_RE = /\b([A-Za-z_$][\w$]*)\.(get|post|put|patch|delete)\s*\(\s*(["'`])([^"'`]+)\3/g;

export const fastifyExtractor: Extractor = {
  name: "fastify",
  appliesTo(file, stack) {
    return stack.includes("fastify") && /\.(ts|js|mjs|cjs)$/.test(file.path);
  },
  extract(ctx) {
    const c = emptyContribution();
    const src = stripComments(ctx.source);
    let m: RegExpExecArray | null;
    while ((m = VERB_RE.exec(src))) {
      c.routes.push({
        framework: "fastify",
        method: m[2].toUpperCase(),
        path: m[4],
        file: ctx.file.path,
      });
    }
    return c;
  },
};
```

Then:

1. Register it in `src/extractors/registry.ts`.
2. Add detection in `src/core/stack-detect.ts` if it needs a stack flag.
3. **Add a fixture + test** (required — see below).

## AST vs regex

Extractors are best-effort by design and run on raw source with regex/line parsing,
which is deterministic and dependency-free. A full AST is available via
`src/extractors/parser.ts` (`parseFile(lang, source)`), backed by **web-tree-sitter**
(WASM). Use it when regex isn't precise enough. It degrades to `null` if a grammar
can't load, so always keep a fallback — the indexer must never crash on one file.

### Adding a new grammar `.wasm`

WASM grammars live in `src/wasm/` and are committed to the repo so consumers never need
a toolchain. See [`src/wasm/README.md`](src/wasm/README.md). In short: drop a prebuilt
`.wasm` in (or generate once with `npx tree-sitter build --wasm`), register it in
`GRAMMAR_FILES` in `parser.ts`, and note its license.

## Tests are required for every extractor PR

Add a small code fixture and assert the extracted output in `test/extractors.test.ts`
(unit) and, if it affects the end-to-end map, extend `examples/sample-next-app/` and the
integration test. Keep fixtures tiny.

## Releasing (maintainers)

CI runs typecheck + lint + tests on Node 18/20/22. Publishing is manual and gated on a
tag: pushing `v*` triggers `.github/workflows/release.yml`, which builds and runs
`npm publish --access public`. It needs an `NPM_TOKEN` repository secret. We never
auto-publish on every commit.

## Commit style

Plain, human commit messages. No AI attribution / co-author trailers.

# ctxbridge

**Stop re-explaining your project every time you switch AI agents.**

When Claude Code hits its limit and you move to Codex — or Cursor, or Antigravity —
the next agent starts blind. `ctxbridge` fixes that. It keeps a small, git-diffable
`.aicontext/` folder in your repo holding the project's living state plus a compact
**map of the codebase** (symbols, routes, DB schema, components — not the code itself).
Any agent reads it in one command and picks up exactly where the last one stopped.


Note- It can also be used to retain context between diifferent claude code , Codex , Cursor or any agent session and agent board feature of this bridge can be used as taskboard handoffs to multiple agents and index feature of agentBridge can be used to index your codebase which saves tokens as AI doesnt need to check whole codebase to find the component first and then do changes , via index it can easily pinpoint where it needs to work.

```bash
npx ctxbridge context
```

- **Zero native deps.** Pure `npx` fetch — no `node-gyp`, no C toolchain. Parsing uses
  WASM tree-sitter, shipped in the package.
- **Offline.** No telemetry, no network, no API key required.
- **Travels with the code.** State lives in `.aicontext/`, committed like everything else.
- **Constant-size context.** The map degrades gracefully so the bundle stays ~budget
  regardless of repo size — it never eats the context window.

## Quickstart

```bash
cd your-project
npx ctxbridge init      # scaffolds .aicontext/, detects your stack, writes agent configs
# ... work with Claude Code / Codex / Cursor as normal ...
npx ctxbridge context   # any agent runs this to get oriented
npx ctxbridge handoff --from claude-code --stopped "..." --next "..."
```

`init` also writes `CLAUDE.md`, `AGENTS.md`, and `.cursorrules` (in a managed block that
never clobbers your own content), so each agent is told to read the bridge automatically —
you don't have to prompt it.

## What a handoff looks like

Below is real `ctxbridge context` output from this repo — the whole project, in ~800 tokens:

```markdown
# Project Context (ctxbridge)

## Current State
## Done
- Deterministic incremental indexer (Next.js, Express, React, Prisma, SQL, Mongoose)
- `context` with token budgeting + graceful degradation
...

## Last Handoff
**Where I stopped:** core loop done, tests green
**What to do next:** wire CI + publish 0.1.0
**Gotchas / watch out for:** index.json must stay byte-stable; sort everything

## Recent Decisions
## 2026-07-07 — Use web-tree-sitter (WASM) instead of native tree-sitter binding

## Codebase Map
### Data model
- users: id, email, created_at
### Files
src/commands/
  context.ts — buildContextData, runContext
  handoff.ts — runHandoff
src/extractors/
  express.ts — expressExtractor
  nextjs.ts — nextjsExtractor
...
```

## How it works

`init` creates `.aicontext/`:

| File | Purpose |
| --- | --- |
| `STATE.md` | The living heartbeat — done / in-progress / next. |
| `PLAN.md` | The roadmap (human/agent prose). |
| `DECISIONS.md` | Append-only architectural decision log. |
| `HANDOFF.md` | The last agent's exit note. |
| `index.json` | **Generated** codebase map (never hand-edited). |
| `config.json` | Optional config (token budget, ignores, extractors). |

Everything here is committed — that's the point. It's the shared context.

The key idea: `index` ships a **map, not the code**. It walks your repo and extracts
exported symbols, framework routes, React components + props, and DB tables/models into
`index.json`. `context` renders a token-budgeted slice of the state + map. As the repo
grows, low-priority sections collapse to directory summaries, so the bundle stays small.

## Command reference

| Command | What it does |
| --- | --- |
| `ctxbridge init` | Scaffold `.aicontext/` + agent configs, detect stack, run first index. |
| `ctxbridge index [--watch] [--verbose]` | Regenerate the codebase map (incremental). |
| `ctxbridge context [--json] [--budget N]` | Emit the compact orientation bundle. |
| `ctxbridge status` | Quick "where are we" glance + index freshness. |
| `ctxbridge handoff --from … --stopped … --next … [--gotchas …] [--files …]` | Write the exit note. |
| `ctxbridge decision "chose X over Y because Z"` | Append a dated decision. |
| `ctxbridge enrich [--apply] [--auto]` | Add one-line AI "purpose" summaries to files. |
| `ctxbridge tasks` | List open/claimed tasks and who they suit. |
| `ctxbridge task add "title" --suited codex,cursor` | Add a task to the board. |
| `ctxbridge task claim t-003 --by codex` | Claim a task. |
| `ctxbridge task done t-003` | Mark a task done. |

`abridge` is a shorter alias for `ctxbridge`.

### Task board

For multi-agent coordination, `ctxbridge task add/claim/done` maintain a git-diffable
`tasks.json` (mirrored to a human-readable `TASKS.md`). `suited` is advisory metadata you
set — e.g. codex→UI, cursor→testing, claude-code→foundation — so an agent reading
`context` knows what to pick up. Open/claimed tasks show up in the `context` bundle.

## config.json reference

All fields optional; a missing `config.json` is fine.

```jsonc
{
  "contextBudget": 2000,                                  // token budget for `context`
  "ignore": ["scripts/**", "*.generated.ts"],             // extra ignore globs
  "extractors": { "express": true, "mongoose": false },   // toggle extractors
  "decisionsInContext": 5,                                // recent decisions shown
  "agentName": "claude-code"                              // default --from for handoff
}
```

## Enrichment (optional, vendor-neutral)

`index.json` structural fields are always regenerated from the AST — AI never rewrites them.
The one AI-written field is a per-file `purpose` one-liner. It's opt-in and needs no API key:

```bash
ctxbridge enrich            # writes .aicontext/enrich-request.md
# your agent reads it, writes .aicontext/enrich-response.json
ctxbridge enrich --apply    # merges the purposes into index.json
```

If `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` is set, `ctxbridge enrich --auto` fills them in
one batched request instead. Only changed files (`purposeStale`) get re-enriched, so cost
stays near zero over time.

## FAQ

**Does it upload my code?** No. Fully offline. `--auto` enrichment is the only thing that
ever calls a network, and only if you set an API key and pass the flag.

**Will it overwrite my `CLAUDE.md`?** No. It edits only a marked managed block and preserves
the rest.

**Which stacks?** Next.js, Express, React, Prisma, Postgres/Supabase SQL, Mongoose today.
Adding one is ~30 lines — see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT

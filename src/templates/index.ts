/**
 * Initial contents for the `.aicontext/` state files and the root agent-config
 * files. Kept as string constants (not standalone .md files) so tsup bundles
 * them into `dist/` — the published package ships only `dist` + `src/wasm`.
 */

export const MANAGED_BEGIN = "<!-- BEGIN agentbridge (managed) -->";
export const MANAGED_END = "<!-- END agentbridge (managed) -->";

export function stateTemplate(now: string): string {
  return `---
updated: ${now}
lastAgent: unknown
phase: setup
---

# Project State

## Done
- (nothing yet)

## In progress
- (nothing yet)

## Next
- (nothing yet)
`;
}

export function handoffTemplate(now: string): string {
  return `---
updated: ${now}
fromAgent: unknown
---

# Handoff

**Where I stopped:** …

**What to do next:** …

**Gotchas / watch out for:** …

**Files I touched:** …
`;
}

export function planTemplate(): string {
  return `# Plan

## Goal
Describe what this project is trying to achieve.

## Roadmap
- [ ] Milestone 1
- [ ] Milestone 2

## Notes
Anything an incoming agent should know about the overall direction.
`;
}

export function decisionsTemplate(): string {
  return `# Decisions

Append-only log of architectural decisions and their rationale.
Newest entries go at the top. Use \`agentbridge decision "…"\` to add one.
`;
}

/** The managed block that goes inside CLAUDE.md / AGENTS.md / .cursorrules. */
export function managedBlock(): string {
  return `${MANAGED_BEGIN}
## Working with this project's context bridge

This repo uses agentbridge to share context across AI agents.

BEFORE you start working, run:
    npx agentbridge context
This prints the current state, plan, recent decisions, the last handoff note, and a compact map of the codebase. Read it so you don't need the human to re-explain.

WHILE working, if you make a notable architectural decision, append it:
    npx agentbridge decision "chose X over Y because Z"

BEFORE you stop (or when you're running low on capacity), write a handoff:
    npx agentbridge handoff --from "<your name>" --stopped "..." --next "..." --gotchas "..."
and refresh the codebase map:
    npx agentbridge index

Keep STATE.md accurate. The next agent depends on it.
${MANAGED_END}`;
}

/** File body for a fresh CLAUDE.md / AGENTS.md (managed block + nothing else). */
export function agentConfigTemplate(title: string): string {
  return `# ${title}

${managedBlock()}
`;
}

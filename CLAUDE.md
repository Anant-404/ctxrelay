# CLAUDE.md

<!-- BEGIN agentbridge (managed) -->
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
<!-- END agentbridge (managed) -->

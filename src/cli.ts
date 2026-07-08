import { Command } from "commander";
import pc from "picocolors";
import { runInit } from "./commands/init.js";
import { runIndex } from "./commands/index.js";
import { runStatus } from "./commands/status.js";
import { runContext } from "./commands/context.js";
import { runHandoff } from "./commands/handoff.js";
import { runDecision } from "./commands/decision.js";
import { runEnrich } from "./commands/enrich.js";
import { registerTasks } from "./commands/tasks.js";

const VERSION = "0.1.0";

function fail(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(pc.red("error: ") + msg);
  process.exit(1);
}

const program = new Command();

program
  .name("ctxrelay")
  .description("Share project context across AI coding agents.")
  .version(VERSION, "-v, --version");

program
  .command("init")
  .description("Scaffold .aicontext/ and agent-config files; detect stack; run first index.")
  .action(async () => {
    try {
      await runInit();
    } catch (e) {
      fail(e);
    }
  });

program
  .command("index")
  .description("Regenerate the codebase map (index.json).")
  .option("--watch", "re-index changed files on save")
  .option("--verbose", "report parsed vs reused file counts")
  .action(async (opts) => {
    try {
      await runIndex({ watch: !!opts.watch, verbose: !!opts.verbose });
    } catch (e) {
      fail(e);
    }
  });

program
  .command("status")
  .description("Quick 'where are we' glance: STATE + last handoff + index freshness.")
  .action(async () => {
    try {
      await runStatus();
    } catch (e) {
      fail(e);
    }
  });

program
  .command("context")
  .description("Emit the compact, token-budgeted orientation bundle for an agent.")
  .option("--json", "output as JSON")
  .option("--format <fmt>", "output format: markdown | text | json", "markdown")
  .option("--budget <n>", "token budget override", (v) => parseInt(v, 10))
  .action(async (opts) => {
    try {
      await runContext({
        json: !!opts.json,
        format: opts.format,
        budget: opts.budget,
      });
    } catch (e) {
      fail(e);
    }
  });

program
  .command("handoff")
  .description("Write the exit note (HANDOFF.md) and update STATE.md.")
  .option("--from <name>", "your agent name")
  .option("--stopped <text>", "where you stopped")
  .option("--next <text>", "what to do next")
  .option("--gotchas <text>", "gotchas / watch-outs")
  .option("--files <text>", "files you touched")
  .action(async (opts) => {
    try {
      await runHandoff(opts);
    } catch (e) {
      fail(e);
    }
  });

program
  .command("decision")
  .description("Append an architectural decision to DECISIONS.md.")
  .argument("<text>", "the decision + rationale")
  .action(async (text) => {
    try {
      await runDecision(text);
    } catch (e) {
      fail(e);
    }
  });

program
  .command("enrich")
  .description("Fill AI 'purpose' fields via prompt-file flow (or --auto with an API key).")
  .option("--apply", "merge enrich-response.json back into index.json")
  .option("--auto", "call an LLM API directly if ANTHROPIC_API_KEY/OPENAI_API_KEY is set")
  .action(async (opts) => {
    try {
      await runEnrich({ apply: !!opts.apply, auto: !!opts.auto });
    } catch (e) {
      fail(e);
    }
  });

registerTasks(program, fail);

program.parseAsync(process.argv).catch(fail);

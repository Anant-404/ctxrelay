import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import { requireProject } from "../core/paths.js";
import { detectStack } from "../core/stack-detect.js";
import { mergeManagedBlock } from "../core/managed-block.js";
import { fileExists, readText, writeText } from "../core/store.js";
import {
  agentConfigTemplate,
  decisionsTemplate,
  handoffTemplate,
  managedBlock,
  planTemplate,
  stateTemplate,
} from "../templates/index.js";
import { runIndex } from "./index.js";

interface AgentConfig {
  file: string;
  title: string;
}

const AGENT_CONFIGS: AgentConfig[] = [
  { file: "CLAUDE.md", title: "CLAUDE.md" },
  { file: "AGENTS.md", title: "AGENTS.md" },
  { file: ".cursorrules", title: "Cursor rules" },
];

/** Write a file only if it does not already exist. Returns true if written. */
function writeIfAbsent(path: string, content: string): boolean {
  if (fileExists(path)) return false;
  writeText(path, content);
  return true;
}

/** Merge the managed block into an agent-config file (create if missing). */
function upsertAgentConfig(root: string, cfg: AgentConfig): void {
  const path = join(root, cfg.file);
  if (fileExists(path)) {
    const merged = mergeManagedBlock(readText(path), managedBlock());
    writeText(path, merged.endsWith("\n") ? merged : merged + "\n");
  } else {
    // Cursor rules are conventionally plain; still fine to carry the block.
    const body =
      cfg.file === ".cursorrules"
        ? managedBlock() + "\n"
        : agentConfigTemplate(cfg.title);
    writeText(path, body);
  }
}

export async function runInit(): Promise<void> {
  const paths = requireProject();
  const now = new Date().toISOString();

  if (!existsSync(paths.aicontext)) {
    mkdirSync(paths.aicontext, { recursive: true });
  }

  // State files — never clobber existing state.
  writeIfAbsent(paths.state, stateTemplate(now));
  writeIfAbsent(paths.plan, planTemplate());
  writeIfAbsent(paths.decisions, decisionsTemplate());
  writeIfAbsent(paths.handoff, handoffTemplate(now));

  // Agent-config files — merge managed block, preserve user content.
  for (const cfg of AGENT_CONFIGS) {
    upsertAgentConfig(paths.root, cfg);
  }

  const { stack, projectName } = detectStack(paths.root);

  // Initial index pass.
  const result = await runIndex({ silent: true });

  // Friendly summary.
  console.log(pc.green("✓ ctxrelay initialized"));
  console.log(`  project:  ${pc.bold(projectName)}`);
  console.log(
    `  stack:    ${stack.length ? stack.map((s) => pc.cyan(s)).join(", ") : pc.dim("none detected")}`
  );
  console.log(`  indexed:  ${result.indexedFiles}/${result.totalFiles} files`);
  console.log("");
  console.log("  Agents use these three commands:");
  console.log(`    ${pc.bold("ctxrelay context")}   read to get oriented`);
  console.log(`    ${pc.bold("ctxrelay handoff")}   write an exit note before stopping`);
  console.log(`    ${pc.bold("ctxrelay index")}     refresh the codebase map`);
}

import pc from "picocolors";
import { requireProject, type ProjectPaths } from "../core/paths.js";
import {
  fileExists,
  readConfig,
  readIndex,
  readJson,
  readMarkdown,
  DEFAULT_CONFIG,
} from "../core/store.js";
import { assemble, estimateTokens, type Section } from "../core/budget.js";
import type { CodebaseIndex } from "../schema/index-schema.js";

export interface ContextOptions {
  json?: boolean;
  format?: string;
  budget?: number;
}

function body(file: string): string {
  if (!fileExists(file)) return "";
  try {
    return readMarkdown(file).body.trim();
  } catch {
    return "";
  }
}

/** First line of each markdown section (## heading) + its opening line. */
function summarizePlan(text: string): string {
  if (!text) return "";
  const lines = text.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^#{1,3}\s/.test(l)) {
      out.push(l);
      const next = lines.slice(i + 1).find((x) => x.trim().length > 0);
      if (next && !/^#{1,3}\s/.test(next)) out.push("  " + next.trim().slice(0, 120));
    }
  }
  return out.join("\n");
}

/** Last N decision entries (## headed blocks). */
function recentDecisions(text: string, n: number): string {
  if (!text) return "";
  const blocks = text.split(/\n(?=##\s)/).filter((b) => b.trim().startsWith("##"));
  return blocks.slice(0, n).join("\n\n").trim();
}

function renderRoutes(index: CodebaseIndex): string {
  if (!index.routes.length) return "";
  const lines = index.routes.map((r) => `- ${r.method} ${r.path}  →  ${r.file}`);
  return "### Routes\n" + lines.join("\n");
}

function renderDb(index: CodebaseIndex): string {
  const parts: string[] = [];
  for (const t of index.db.postgres) parts.push(`- ${t.table}: ${t.columns.join(", ")}`);
  for (const m of index.db.prisma) parts.push(`- ${m.model} (prisma): ${m.fields.join(", ")}`);
  for (const c of index.db.mongo) parts.push(`- ${c.collection} (mongo): ${c.fields.join(", ")}`);
  if (!parts.length) return "";
  return "### Data model\n" + parts.join("\n");
}

function renderComponents(index: CodebaseIndex): string {
  if (!index.components.length) return "";
  const lines = index.components.map((c) => {
    const props = c.props.length ? ` (${c.props.join(", ")})` : "";
    const kind = c.client ? "client" : "server";
    return `- ${c.name}${props} [${kind}]  ${c.file}`;
  });
  return "### Components\n" + lines.join("\n");
}

function dirOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "." : path.slice(0, i);
}

/** Full file list grouped by directory. */
function renderFiles(index: CodebaseIndex): string {
  if (!index.files.length) return "";
  const byDir = new Map<string, string[]>();
  for (const f of index.files) {
    const d = dirOf(f.path);
    const name = f.path.slice(d === "." ? 0 : d.length + 1);
    const exp = f.exports
      .slice(0, 6)
      .map((e) => e.name)
      .join(", ");
    const desc = f.purpose ? ` — ${f.purpose}` : exp ? ` — ${exp}` : "";
    if (!byDir.has(d)) byDir.set(d, []);
    byDir.get(d)!.push(`  ${name}${desc}`);
  }
  const dirs = [...byDir.keys()].sort();
  const out: string[] = ["### Files"];
  for (const d of dirs) {
    out.push(`${d}/`);
    out.push(...byDir.get(d)!);
  }
  return out.join("\n");
}

/** Directory-level summary used when the full file list is over budget. */
function collapseFiles(index: CodebaseIndex): string {
  if (!index.files.length) return "";
  const counts = new Map<string, number>();
  for (const f of index.files) {
    const d = dirOf(f.path);
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const dirs = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const out = ["### Files (summary)"];
  for (const [d, n] of dirs) out.push(`- ${d}/ — ${n} file${n === 1 ? "" : "s"}`);
  return out.join("\n");
}

function renderTasks(paths: ProjectPaths): string {
  if (!fileExists(paths.tasks)) return "";
  try {
    const tasks = readJson<Array<Record<string, unknown>>>(paths.tasks);
    const open = tasks.filter((t) => t.status === "open" || t.status === "claimed");
    if (!open.length) return "";
    const lines = open.slice(0, 10).map((t) => {
      const suited = Array.isArray(t.suited) ? ` [${(t.suited as string[]).join(",")}]` : "";
      const by = t.claimedBy ? ` (claimed by ${t.claimedBy})` : "";
      return `- ${t.id} ${t.title}${suited}${by}`;
    });
    return "### Open tasks\n" + lines.join("\n");
  } catch {
    return "";
  }
}

export function buildContextData(paths: ProjectPaths) {
  const index = readIndex(paths);
  const config = readConfig(paths);
  return {
    state: body(paths.state),
    handoff: body(paths.handoff),
    plan: body(paths.plan),
    decisions: body(paths.decisions),
    index,
    tasks: fileExists(paths.tasks) ? readJson(paths.tasks) : [],
    config,
  };
}

export async function runContext(opts: ContextOptions = {}): Promise<void> {
  const paths = requireProject();
  const config = readConfig(paths);
  const budget = opts.budget ?? config.contextBudget ?? DEFAULT_CONFIG.contextBudget;
  const decisionsN = config.decisionsInContext ?? DEFAULT_CONFIG.decisionsInContext;

  const data = buildContextData(paths);
  const index = data.index;

  if (opts.json || opts.format === "json") {
    const out = {
      state: data.state,
      handoff: data.handoff,
      plan: summarizePlan(data.plan),
      decisions: recentDecisions(data.decisions, decisionsN),
      stack: index?.stack ?? [],
      routes: index?.routes ?? [],
      components: index?.components ?? [],
      db: index?.db ?? { postgres: [], prisma: [], mongo: [] },
      tasks: data.tasks,
    };
    process.stdout.write(JSON.stringify(out, null, 2) + "\n");
    return;
  }

  const sections: Section[] = [];

  if (data.state) {
    sections.push({ priority: 1, name: "state", render: () => `## Current State\n${data.state}` });
  }
  if (data.handoff) {
    sections.push({
      priority: 2,
      name: "handoff",
      render: () => `## Last Handoff\n${data.handoff}`,
    });
  }
  const tasksBlock = renderTasks(paths);
  if (tasksBlock) {
    sections.push({ priority: 3, name: "tasks", render: () => `## Tasks\n${tasksBlock}` });
  }
  if (data.plan) {
    sections.push({
      priority: 4,
      name: "plan",
      render: () => `## Plan\n${summarizePlan(data.plan)}`,
    });
  }
  const dec = recentDecisions(data.decisions, decisionsN);
  if (dec) {
    sections.push({ priority: 5, name: "decisions", render: () => `## Recent Decisions\n${dec}` });
  }

  if (index) {
    const stackLine = index.stack.length ? `**Stack:** ${index.stack.join(", ")}` : "";
    sections.push({
      priority: 6,
      name: "map-head",
      render: () =>
        `## Codebase Map\n${stackLine}\n_${index.stats.indexedFiles} files, ${index.stats.loc} lines_`,
    });
    const routes = renderRoutes(index);
    if (routes) sections.push({ priority: 7, name: "routes", render: () => routes });
    const db = renderDb(index);
    if (db) sections.push({ priority: 8, name: "db", render: () => db });
    const comps = renderComponents(index);
    if (comps)
      sections.push({
        priority: 9,
        name: "components",
        render: () => comps,
        collapse: () => `### Components\n- ${index.components.length} components`,
      });
    sections.push({
      priority: 10,
      name: "files",
      render: () => renderFiles(index),
      collapse: () => collapseFiles(index),
    });
  }

  const { text, tokens } = assemble(sections, budget);
  const header = "# Project Context (agentbridge)\n";
  const full = header + "\n" + text + "\n";

  process.stdout.write(full);
  console.error(pc.dim(`~${tokens + estimateTokens(header)} tokens (budget ${budget})`));
}

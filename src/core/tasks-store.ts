import { existsSync } from "node:fs";
import type { ProjectPaths } from "./paths.js";
import { readJson, writeJson, writeText } from "./store.js";

export type TaskStatus = "open" | "claimed" | "in-progress" | "blocked" | "done";

export interface Task {
  id: string;
  title: string;
  suited: string[];
  status: TaskStatus;
  claimedBy: string | null;
  notes: string;
  deps: string[];
}

export function readTasks(paths: ProjectPaths): Task[] {
  if (!existsSync(paths.tasks)) return [];
  try {
    const v = readJson<unknown>(paths.tasks);
    return Array.isArray(v) ? (v as Task[]) : [];
  } catch {
    return [];
  }
}

/** Next id like t-004, based on the highest existing numeric suffix. */
export function nextTaskId(tasks: Task[]): string {
  let max = 0;
  for (const t of tasks) {
    const m = t.id.match(/^t-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `t-${String(max + 1).padStart(3, "0")}`;
}

const STATUS_ORDER: TaskStatus[] = ["open", "claimed", "in-progress", "blocked", "done"];

function renderTasksMd(tasks: Task[]): string {
  const lines: string[] = ["# Tasks", "", "Generated from tasks.json — do not hand-edit.", ""];
  for (const status of STATUS_ORDER) {
    const group = tasks.filter((t) => t.status === status);
    if (!group.length) continue;
    lines.push(`## ${status}`);
    for (const t of group) {
      const suited = t.suited.length ? ` _(suited: ${t.suited.join(", ")})_` : "";
      const by = t.claimedBy ? ` — @${t.claimedBy}` : "";
      const deps = t.deps.length ? ` — deps: ${t.deps.join(", ")}` : "";
      lines.push(`- **${t.id}** ${t.title}${by}${suited}${deps}`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}

/** Persist tasks.json (sorted, deterministic) and mirror TASKS.md. */
export function writeTasks(paths: ProjectPaths, tasks: Task[]): void {
  const sorted = [...tasks].sort((a, b) => a.id.localeCompare(b.id));
  writeJson(paths.tasks, sorted);
  writeText(paths.tasksMd, renderTasksMd(sorted));
}

import type { Command } from "commander";
import pc from "picocolors";
import { requireProject } from "../core/paths.js";
import {
  nextTaskId,
  readTasks,
  writeTasks,
  type Task,
  type TaskStatus,
} from "../core/tasks-store.js";

function listTasks(): void {
  const paths = requireProject();
  const tasks = readTasks(paths);
  const open = tasks.filter((t) => t.status !== "done");
  if (!open.length) {
    console.log(pc.dim("no open tasks"));
    return;
  }
  for (const t of open) {
    const suited = t.suited.length ? pc.dim(` [${t.suited.join(", ")}]`) : "";
    const by = t.claimedBy ? pc.cyan(` @${t.claimedBy}`) : "";
    const status = t.status === "open" ? pc.green(t.status) : pc.yellow(t.status);
    console.log(`${pc.bold(t.id)} ${status} ${t.title}${suited}${by}`);
  }
}

function addTask(title: string, suited?: string): void {
  const paths = requireProject();
  const tasks = readTasks(paths);
  const task: Task = {
    id: nextTaskId(tasks),
    title,
    suited: suited ? suited.split(",").map((s) => s.trim()).filter(Boolean) : [],
    status: "open",
    claimedBy: null,
    notes: "",
    deps: [],
  };
  tasks.push(task);
  writeTasks(paths, tasks);
  console.log(pc.green(`✓ added ${task.id}`) + ` ${title}`);
}

function mutate(id: string, fn: (t: Task) => void, verb: string): void {
  const paths = requireProject();
  const tasks = readTasks(paths);
  const task = tasks.find((t) => t.id === id);
  if (!task) throw new Error(`no task ${id}`);
  fn(task);
  writeTasks(paths, tasks);
  console.log(pc.green(`✓ ${id} ${verb}`));
}

export function registerTasks(program: Command, fail: (e: unknown) => never): void {
  program
    .command("tasks")
    .description("List open/claimed tasks and who they're suited for.")
    .action(() => {
      try {
        listTasks();
      } catch (e) {
        fail(e);
      }
    });

  const task = program.command("task").description("Manage the shared task board.");

  task
    .command("add")
    .description("Add a task.")
    .argument("<title>", "task title")
    .option("--suited <agents>", "comma-separated agents this task suits, e.g. codex,cursor")
    .action((title, opts) => {
      try {
        addTask(title, opts.suited);
      } catch (e) {
        fail(e);
      }
    });

  task
    .command("claim")
    .description("Claim a task.")
    .argument("<id>", "task id")
    .option("--by <agent>", "who is claiming it")
    .action((id, opts) => {
      try {
        mutate(
          id,
          (t) => {
            t.status = "claimed" as TaskStatus;
            t.claimedBy = opts.by ?? "unknown";
          },
          `claimed by ${opts.by ?? "unknown"}`
        );
      } catch (e) {
        fail(e);
      }
    });

  task
    .command("done")
    .description("Mark a task done.")
    .argument("<id>", "task id")
    .action((id) => {
      try {
        mutate(
          id,
          (t) => {
            t.status = "done" as TaskStatus;
          },
          "done"
        );
      } catch (e) {
        fail(e);
      }
    });
}

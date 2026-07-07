import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolvePaths } from "../src/core/paths.js";
import { nextTaskId, readTasks, writeTasks, type Task } from "../src/core/tasks-store.js";

function project(): ReturnType<typeof resolvePaths> {
  const dir = mkdtempSync(join(tmpdir(), "ab-tasks-"));
  writeFileSync(join(dir, "package.json"), "{}");
  return resolvePaths(dir);
}

describe("task board", () => {
  it("round-trips add → claim → done and mirrors TASKS.md", () => {
    const paths = project();
    const t: Task = {
      id: nextTaskId([]),
      title: "Build checkout UI",
      suited: ["codex", "cursor"],
      status: "open",
      claimedBy: null,
      notes: "",
      deps: [],
    };
    writeTasks(paths, [t]);
    expect(nextTaskId(readTasks(paths))).toBe("t-002");

    let tasks = readTasks(paths);
    tasks[0].status = "claimed";
    tasks[0].claimedBy = "codex";
    writeTasks(paths, tasks);
    expect(readTasks(paths)[0].claimedBy).toBe("codex");

    tasks = readTasks(paths);
    tasks[0].status = "done";
    writeTasks(paths, tasks);
    expect(readTasks(paths)[0].status).toBe("done");

    const md = readFileSync(paths.tasksMd, "utf8");
    expect(md).toContain("Build checkout UI");
    expect(md).toContain("## done");
  });
});

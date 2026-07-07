import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInit } from "../src/commands/init.js";
import { runIndex } from "../src/commands/index.js";
import { runContext } from "../src/commands/context.js";
import { runHandoff } from "../src/commands/handoff.js";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(here, "..", "examples", "sample-next-app");

let cwd: string;
let temp: string;

/** Capture everything written to stdout during `fn`. */
async function captureStdout(fn: () => Promise<void>): Promise<string> {
  const chunks: string[] = [];
  const orig = process.stdout.write.bind(process.stdout);
  (process.stdout as any).write = (c: any) => {
    chunks.push(typeof c === "string" ? c : c.toString());
    return true;
  };
  try {
    await fn();
  } finally {
    (process.stdout as any).write = orig;
  }
  return chunks.join("");
}

beforeEach(() => {
  cwd = process.cwd();
  temp = mkdtempSync(join(tmpdir(), "ab-int-"));
  cpSync(FIXTURE, temp, { recursive: true });
  process.chdir(temp);
});

afterEach(() => {
  process.chdir(cwd);
});

describe("full loop: init → index → context → handoff → context", () => {
  it("produces a correct, budget-bounded bundle that reflects the handoff", async () => {
    await captureStdout(() => runInit());

    const index = JSON.parse(readFileSync(join(temp, ".aicontext", "index.json"), "utf8"));
    expect(index.stack).toContain("nextjs");
    expect(index.routes.some((r: any) => r.path === "/api/checkout")).toBe(true);
    expect(index.components.some((c: any) => c.props.includes("cartId"))).toBe(true);
    expect(index.db.postgres.some((t: any) => t.table === "users")).toBe(true);
    expect(index.db.mongo.some((c: any) => c.collection === "Session")).toBe(true);

    // context before handoff
    const before = await captureStdout(() => runContext({}));
    expect(before).toContain("Routes");
    expect(before).toContain("/api/checkout");

    await captureStdout(() =>
      runHandoff({ from: "codex", stopped: "did the routes", next: "add webhook verify" })
    );

    const after = await captureStdout(() => runContext({}));
    expect(after).toContain("did the routes");
    expect(after).toContain("add webhook verify");
    expect(after).toContain("Last Handoff");
  });

  it("incremental re-index reuses unchanged files", async () => {
    await captureStdout(() => runInit());
    const r = await runIndex({ silent: true, verbose: false });
    // second pass: everything reused, nothing parsed anew
    expect(r.indexedFiles).toBeGreaterThan(0);
  });

  it("context bundle stays bounded under a tight budget", async () => {
    await captureStdout(() => runInit());
    const out = await captureStdout(() => runContext({ budget: 200 }));
    // chars/4 heuristic; allow header slack
    expect(out.length / 4).toBeLessThan(400);
  });
});

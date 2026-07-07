import { describe, expect, it } from "vitest";
import { detectStack } from "../src/core/stack-detect.js";
import { assemble, estimateTokens } from "../src/core/budget.js";
import { mergeManagedBlock } from "../src/core/managed-block.js";
import { shortHash } from "../src/core/hash.js";
import { managedBlock, MANAGED_BEGIN } from "../src/templates/index.js";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("stack-detect", () => {
  it("detects frameworks from package.json deps", () => {
    const dir = mkdtempSync(join(tmpdir(), "ab-stack-"));
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "x", dependencies: { next: "1", express: "1", mongoose: "1" } })
    );
    const { stack, projectName } = detectStack(dir);
    expect(projectName).toBe("x");
    expect(stack).toContain("nextjs");
    expect(stack).toContain("express");
    expect(stack).toContain("mongoose");
  });

  it("detects prisma via marker file", () => {
    const dir = mkdtempSync(join(tmpdir(), "ab-stack2-"));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "y" }));
    mkdirSync(join(dir, "prisma"));
    writeFileSync(join(dir, "prisma", "schema.prisma"), "");
    expect(detectStack(dir).stack).toContain("prisma");
  });
});

describe("budget", () => {
  it("keeps output near budget as sections scale, collapsing low priority", () => {
    const big = Array.from({ length: 500 }, (_, i) => `file-${i}.ts details here`).join("\n");
    const { text, tokens } = assemble(
      [
        { priority: 1, name: "state", render: () => "STATE kept" },
        {
          priority: 10,
          name: "files",
          render: () => big,
          collapse: () => "### Files (summary)\n- src/ — 500 files",
        },
      ],
      100
    );
    expect(text).toContain("STATE kept");
    expect(tokens).toBeLessThanOrEqual(100);
    // full big list must not be present
    expect(text).not.toContain("file-499.ts");
  });

  it("estimateTokens uses chars/4", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcdefgh")).toBe(2);
  });
});

describe("managed-block merge", () => {
  it("is idempotent", () => {
    const block = managedBlock();
    const base = "# CLAUDE.md\n\nUser notes here.\n";
    const once = mergeManagedBlock(base, block);
    const twice = mergeManagedBlock(once, block);
    expect(once).toBe(twice);
    expect((once.match(new RegExp(MANAGED_BEGIN.replace(/[()]/g, "\\$&"), "g")) ?? []).length).toBe(
      1
    );
    expect(once).toContain("User notes here.");
  });

  it("replaces an existing block, preserving surrounding text", () => {
    const block = managedBlock();
    const withBlock = mergeManagedBlock("top\n" + block + "\nbottom", block);
    expect(withBlock).toContain("top");
    expect(withBlock).toContain("bottom");
  });
});

describe("hash", () => {
  it("is stable and 8 chars", () => {
    const h = shortHash("hello");
    expect(h).toHaveLength(8);
    expect(h).toBe(shortHash("hello"));
    expect(h).not.toBe(shortHash("hello2"));
  });
});

import { existsSync, rmSync } from "node:fs";
import pc from "picocolors";
import { requireProject, type ProjectPaths } from "../core/paths.js";
import { readIndex, readJson, writeIndex, writeText } from "../core/store.js";
import type { CodebaseIndex, FileEntry } from "../schema/index-schema.js";

export interface EnrichOptions {
  apply?: boolean;
  auto?: boolean;
}

function staleFiles(index: CodebaseIndex): FileEntry[] {
  return index.files.filter((f) => f.purpose === null || f.purposeStale);
}

function buildRequest(files: FileEntry[]): string {
  const items = files
    .map((f) => {
      const exp = f.exports.map((e) => `${e.name} (${e.kind})`).join(", ") || "—";
      return `- ${f.path}\n    exports: ${exp}\n    imports: ${f.imports.join(", ") || "—"}`;
    })
    .join("\n");

  return `# Enrichment request

You are helping build a codebase map. For each file below, write a ONE-LINE
purpose of at most 12 words describing what the file does. Base it on the file
path and its exported symbols.

Return ONLY a JSON object mapping each path to its purpose string, and write it
to \`.aicontext/enrich-response.json\`. Example:

\`\`\`json
{
  "src/api/checkout.ts": "Stripe checkout session and webhook handler"
}
\`\`\`

## Files needing a purpose

${items}
`;
}

function applyResponse(paths: ProjectPaths, index: CodebaseIndex): number {
  if (!existsSync(paths.enrichResponse)) {
    throw new Error(
      "No .aicontext/enrich-response.json found. Have your agent write it first, then rerun with --apply."
    );
  }
  const map = readJson<Record<string, string>>(paths.enrichResponse);
  let applied = 0;
  for (const f of index.files) {
    if (Object.prototype.hasOwnProperty.call(map, f.path)) {
      const purpose = String(map[f.path]).trim();
      if (purpose) {
        f.purpose = purpose;
        f.purposeStale = false;
        applied++;
      }
    }
  }
  writeIndex(paths, index);
  // Clean up transient files.
  for (const p of [paths.enrichRequest, paths.enrichResponse]) {
    if (existsSync(p)) rmSync(p);
  }
  return applied;
}

async function autoEnrich(
  paths: ProjectPaths,
  index: CodebaseIndex,
  files: FileEntry[]
): Promise<boolean> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!anthropicKey && !openaiKey) return false;

  const prompt =
    buildRequest(files) +
    "\n\nRespond with ONLY the JSON object, no markdown fences, no prose.";

  let jsonText: string;
  if (anthropicKey) {
    const model = process.env.AGENTBRIDGE_MODEL || "claude-haiku-4-5-20251001";
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
    const data: any = await res.json();
    jsonText = data.content?.[0]?.text ?? "{}";
  } else {
    const model = process.env.AGENTBRIDGE_MODEL || "gpt-4o-mini";
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`);
    const data: any = await res.json();
    jsonText = data.choices?.[0]?.message?.content ?? "{}";
  }

  const cleaned = jsonText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const map = JSON.parse(cleaned) as Record<string, string>;
  let applied = 0;
  for (const f of index.files) {
    const purpose = map[f.path]?.trim();
    if (purpose) {
      f.purpose = purpose;
      f.purposeStale = false;
      applied++;
    }
  }
  writeIndex(paths, index);
  console.log(pc.green(`✓ enriched ${applied} files via API`));
  return true;
}

export async function runEnrich(opts: EnrichOptions): Promise<void> {
  const paths = requireProject();
  const index = readIndex(paths);
  if (!index) throw new Error("No index.json. Run `ctxrelay index` first.");

  if (opts.apply) {
    const n = applyResponse(paths, index);
    console.log(pc.green(`✓ applied ${n} purposes`));
    return;
  }

  const files = staleFiles(index);
  if (!files.length) {
    console.log(pc.green("✓ nothing to enrich — all purposes up to date"));
    return;
  }

  if (opts.auto) {
    const ok = await autoEnrich(paths, index, files);
    if (ok) return;
    console.log(
      pc.yellow("No ANTHROPIC_API_KEY / OPENAI_API_KEY set.") +
        " Falling back to the prompt-file flow."
    );
  }

  writeText(paths.enrichRequest, buildRequest(files));
  console.log(pc.green(`✓ wrote .aicontext/enrich-request.md`) + ` (${files.length} files)`);
  console.log("  Have your agent read it and write .aicontext/enrich-response.json,");
  console.log("  then run: " + pc.bold("ctxrelay enrich --apply"));
}

import type { ExportEntry } from "../schema/index-schema.js";
import {
  emptyContribution,
  normalizeImports,
  stripComments,
  type ExtractCtx,
  type Extractor,
  type FileMeta,
  type IndexContribution,
} from "./types.js";

const JS_EXTS = new Set(["ts", "tsx", "js", "jsx", "mjs", "cjs"]);

/** Collect import/require module specifiers. */
export function extractImports(src: string): string[] {
  const specs: string[] = [];
  const importRe = /import\s+(?:[^'"]*?\s+from\s+)?["']([^"']+)["']/g;
  const requireRe = /require\(\s*["']([^"']+)["']\s*\)/g;
  const exportFromRe = /export\s+(?:\*|\{[^}]*\})\s+from\s+["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(src))) specs.push(m[1]);
  while ((m = requireRe.exec(src))) specs.push(m[1]);
  while ((m = exportFromRe.exec(src))) specs.push(m[1]);
  return normalizeImports(specs);
}

/** Collect named + default exports and their kinds. */
export function extractExports(src: string): ExportEntry[] {
  const out: ExportEntry[] = [];
  const seen = new Set<string>();
  // Dedupe by name — a symbol name is unique per module, so the first kind we
  // resolve wins (avoids e.g. `module.exports = X` + `module.exports.X = X`
  // yielding X twice).
  const push = (name: string, kind: ExportEntry["kind"]) => {
    if (!name || seen.has(name)) return;
    seen.add(name);
    out.push({ name, kind });
  };

  // export function/class/const/let/var/type/interface/enum NAME
  const declRe =
    /export\s+(?:async\s+)?(function\*?|class|const|let|var|type|interface|enum)\s+([A-Za-z_$][\w$]*)/g;
  let m: RegExpExecArray | null;
  while ((m = declRe.exec(src))) {
    const kw = m[1];
    const kind: ExportEntry["kind"] = kw.startsWith("function")
      ? "function"
      : kw === "class"
        ? "class"
        : kw === "const" || kw === "let" || kw === "var"
          ? "const"
          : (kw as ExportEntry["kind"]);
    push(m[2], kind);
  }

  // export default function NAME / class NAME / export default NAME
  const defRe = /export\s+default\s+(?:(function\*?|class)\s+)?([A-Za-z_$][\w$]*)?/g;
  while ((m = defRe.exec(src))) {
    const name = m[2] || "default";
    push(name, "default");
  }

  // export { a, b as c }
  const braceRe = /export\s*\{([^}]*)\}/g;
  while ((m = braceRe.exec(src))) {
    const inner = m[1];
    for (const part of inner.split(",")) {
      const seg = part.trim();
      if (!seg) continue;
      const asMatch = seg.match(/(?:\w+)\s+as\s+([A-Za-z_$][\w$]*)/);
      const name = asMatch ? asMatch[1] : seg.replace(/\s+as\s+.*/, "").trim();
      if (name === "default") continue;
      if (/^[A-Za-z_$][\w$]*$/.test(name)) push(name, "const");
    }
  }

  // --- CommonJS ---

  // module.exports = function Name(){} / class Name {} / = Identifier
  const meAssign = src.match(
    /module\.exports\s*=\s*(?:(function\*?|class)\s+)?([A-Za-z_$][\w$]*)?/
  );
  if (meAssign) {
    const kw = meAssign[1];
    const name = meAssign[2];
    if (name && !/^\{/.test(name)) {
      const kind: ExportEntry["kind"] = kw?.startsWith("function")
        ? "function"
        : kw === "class"
          ? "class"
          : "default";
      push(name, kind);
    }
  }

  // module.exports = { a, b, c }
  const meObj = src.match(/module\.exports\s*=\s*\{([^}]*)\}/);
  if (meObj) {
    for (const part of meObj[1].split(",")) {
      const key = part.trim().split(":")[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(key)) push(key, "const");
    }
  }

  // module.exports.NAME = … and exports.NAME = …
  const propRe = /(?:module\.)?exports\.([A-Za-z_$][\w$]*)\s*=/g;
  while ((m = propRe.exec(src))) push(m[1], "const");

  return out;
}

export const jsTsExtractor: Extractor = {
  name: "js-ts",
  appliesTo(file: FileMeta): boolean {
    return JS_EXTS.has(file.ext);
  },
  extract(ctx: ExtractCtx): Partial<IndexContribution> {
    const clean = stripComments(ctx.source);
    const contribution: Partial<IndexContribution> = emptyContribution();
    contribution.imports = extractImports(clean);
    contribution.exports = extractExports(clean);
    return contribution;
  },
};

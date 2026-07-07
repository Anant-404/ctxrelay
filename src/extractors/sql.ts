import type { PostgresTable } from "../schema/index-schema.js";
import {
  emptyContribution,
  type ExtractCtx,
  type Extractor,
  type FileMeta,
  type IndexContribution,
} from "./types.js";

/**
 * Best-effort CREATE TABLE parser. Handles the common
 * `CREATE TABLE [IF NOT EXISTS] name ( col type, ... )` shape. Complex DDL
 * (constraints spanning lines, quoted identifiers with commas) is approximated.
 */
function parseColumns(body: string): string[] {
  const cols: string[] = [];
  // Split on top-level commas (ignore commas inside parens).
  let depth = 0;
  let cur = "";
  const parts: string[] = [];
  for (const ch of body) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur);

  const CONSTRAINT = /^(primary|foreign|unique|constraint|check|key|index)\b/i;
  for (const raw of parts) {
    const t = raw.trim();
    if (!t || CONSTRAINT.test(t)) continue;
    const nm = t.match(/^["'`]?([A-Za-z_][\w]*)["'`]?/);
    if (nm) cols.push(nm[1]);
  }
  return cols;
}

export function extractTables(source: string, sourceFile: string): PostgresTable[] {
  const tables: PostgresTable[] = [];
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?["'`]?([\w.]+)["'`]?\s*\(/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const name = m[1].split(".").pop() || m[1];
    // Find matching close paren for the opening at m.index + m[0].length - 1
    const start = re.lastIndex - 1;
    let depth = 0;
    let end = start;
    for (let i = start; i < source.length; i++) {
      if (source[i] === "(") depth++;
      else if (source[i] === ")") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    const body = source.slice(start + 1, end);
    tables.push({ table: name, columns: parseColumns(body), source: sourceFile });
  }
  return tables;
}

export const sqlExtractor: Extractor = {
  name: "sql",
  appliesTo(file: FileMeta): boolean {
    return file.ext === "sql";
  },
  extract(ctx: ExtractCtx): Partial<IndexContribution> {
    const contribution = emptyContribution();
    contribution.postgres = extractTables(ctx.source, ctx.file.path);
    return contribution;
  },
};

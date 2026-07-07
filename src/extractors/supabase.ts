import type { PostgresTable } from "../schema/index-schema.js";
import {
  emptyContribution,
  type ExtractCtx,
  type Extractor,
  type FileMeta,
  type IndexContribution,
} from "./types.js";

/**
 * Best-effort reader for Supabase generated types. Looks for the
 * `Tables: { <name>: { Row: { <col>: type ... } } }` shape emitted by
 * `supabase gen types typescript`. SQL migrations are handled by sql.ts.
 */
export const supabaseExtractor: Extractor = {
  name: "supabase",
  appliesTo(file: FileMeta, stack: string[]): boolean {
    if (!stack.includes("supabase")) return false;
    return /database\.types\.ts$|supabase.*types.*\.ts$/i.test(file.path);
  },
  extract(ctx: ExtractCtx): Partial<IndexContribution> {
    const contribution = emptyContribution();
    const src = ctx.source;
    const tables: PostgresTable[] = [];

    const tablesBlock = src.match(/Tables\s*:\s*\{/);
    if (!tablesBlock) return contribution;

    // Find each `<name>: { Row: { ... } }` under Tables.
    const tableRe = /([A-Za-z_][\w]*)\s*:\s*\{\s*Row\s*:\s*\{([^}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = tableRe.exec(src))) {
      const name = m[1];
      const rowBody = m[2];
      const columns: string[] = [];
      const colRe = /([A-Za-z_][\w]*)\s*:/g;
      let c: RegExpExecArray | null;
      while ((c = colRe.exec(rowBody))) columns.push(c[1]);
      tables.push({ table: name, columns, source: ctx.file.path });
    }

    contribution.postgres = tables;
    return contribution;
  },
};

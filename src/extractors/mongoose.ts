import type { MongoCollection } from "../schema/index-schema.js";
import {
  emptyContribution,
  stripComments,
  type ExtractCtx,
  type Extractor,
  type FileMeta,
  type IndexContribution,
} from "./types.js";

const JS_EXTS = new Set(["ts", "tsx", "js", "jsx", "mjs", "cjs"]);

function topLevelFields(objectBody: string): string[] {
  const fields: string[] = [];
  let depth = 0;
  let cur = "";
  const parts: string[] = [];
  for (const ch of objectBody) {
    if (ch === "{" || ch === "[" || ch === "(") depth++;
    else if (ch === "}" || ch === "]" || ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur);
  for (const raw of parts) {
    const t = raw.trim();
    const nm = t.match(/^["'`]?([A-Za-z_$][\w$]*)["'`]?\s*:/);
    if (nm) fields.push(nm[1]);
  }
  return fields;
}

export const mongooseExtractor: Extractor = {
  name: "mongoose",
  appliesTo(file: FileMeta, stack: string[]): boolean {
    return stack.includes("mongoose") && JS_EXTS.has(file.ext);
  },
  extract(ctx: ExtractCtx): Partial<IndexContribution> {
    const contribution = emptyContribution();
    const src = stripComments(ctx.source);
    const collections: MongoCollection[] = [];

    // new Schema({ ... }) — capture the object body by brace matching.
    const schemaRe = /new\s+(?:mongoose\.)?Schema\s*(?:<[^>]*>)?\s*\(\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = schemaRe.exec(src))) {
      const start = src.indexOf("{", m.index + m[0].length - 1);
      let depth = 0;
      let end = start;
      for (let i = start; i < src.length; i++) {
        if (src[i] === "{") depth++;
        else if (src[i] === "}") {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      const body = src.slice(start + 1, end);
      const fields = topLevelFields(body);
      // Name from a nearby model(...) or the variable name.
      const nameMatch =
        src.match(/model\s*(?:<[^>]*>)?\s*\(\s*["'`]([A-Za-z_][\w]*)["'`]/) ||
        src.match(/const\s+([A-Za-z_][\w]*)\s*=\s*new\s+(?:mongoose\.)?Schema/);
      const name = nameMatch ? nameMatch[1] : "Collection";
      collections.push({ collection: name, fields });
    }

    contribution.mongo = collections;
    return contribution;
  },
};

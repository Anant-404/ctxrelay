import type { RouteEntry } from "../schema/index-schema.js";
import {
  emptyContribution,
  stripComments,
  type ExtractCtx,
  type Extractor,
  type FileMeta,
  type IndexContribution,
} from "./types.js";

const VERB_RE =
  /\b([A-Za-z_$][\w$]*)\.(get|post|put|patch|delete|head|options|all)\s*\(\s*(["'`])([^"'`]+)\3/g;

const JS_EXTS = new Set(["ts", "tsx", "js", "jsx", "mjs", "cjs"]);

export const expressExtractor: Extractor = {
  name: "express",
  appliesTo(file: FileMeta, stack: string[]): boolean {
    return stack.includes("express") && JS_EXTS.has(file.ext);
  },
  extract(ctx: ExtractCtx): Partial<IndexContribution> {
    const contribution = emptyContribution();
    const src = stripComments(ctx.source);
    const routes: RouteEntry[] = [];

    // Best-effort mount prefix: app.use('/api', router)
    const mounts: string[] = [];
    const mountRe = /\.use\s*\(\s*(["'`])(\/[^"'`]*)\1\s*,/g;
    let mm: RegExpExecArray | null;
    while ((mm = mountRe.exec(src))) mounts.push(mm[2]);

    let m: RegExpExecArray | null;
    while ((m = VERB_RE.exec(src))) {
      const receiver = m[1];
      const verb = m[2].toUpperCase();
      let path = m[4];
      // If the receiver is a router and a single static mount exists, prefix it.
      if (/router/i.test(receiver) && mounts.length === 1) {
        path = (mounts[0] + path).replace(/\/{2,}/g, "/");
      }
      routes.push({ framework: "express", method: verb, path, file: ctx.file.path });
    }

    contribution.routes = routes;
    return contribution;
  },
};

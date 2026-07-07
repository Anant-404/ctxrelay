import type { RouteEntry } from "../schema/index-schema.js";
import {
  emptyContribution,
  stripComments,
  type ExtractCtx,
  type Extractor,
  type FileMeta,
  type IndexContribution,
} from "./types.js";

const HTTP_VERBS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

function isClient(src: string): boolean {
  return /^\s*["']use client["']/m.test(src);
}

/** Convert an app-router file path to a URL path. */
function appPagePath(rel: string): string {
  // app/dashboard/page.tsx -> /dashboard ; app/page.tsx -> /
  let p = rel.replace(/^app\//, "").replace(/\/(page|route)\.(tsx?|jsx?)$/, "");
  if (p === "page.tsx" || p === "page.jsx" || p === "" || p === rel) p = "";
  // route groups (folder) removed; [param] kept as :param
  p = p
    .split("/")
    .filter((seg) => !/^\(.*\)$/.test(seg))
    .map((seg) => seg.replace(/^\[\.\.\.(.+)\]$/, "*$1").replace(/^\[(.+)\]$/, ":$1"))
    .join("/");
  return "/" + p;
}

function pagesPath(rel: string): string {
  // pages/api/users.ts -> /api/users ; pages/index.tsx -> /
  let p = rel.replace(/^pages\//, "").replace(/\.(tsx?|jsx?)$/, "");
  p = p.replace(/\/index$/, "").replace(/^index$/, "");
  p = p
    .split("/")
    .map((seg) => seg.replace(/^\[\.\.\.(.+)\]$/, "*$1").replace(/^\[(.+)\]$/, ":$1"))
    .join("/");
  return "/" + p;
}

export const nextjsExtractor: Extractor = {
  name: "nextjs",
  appliesTo(file: FileMeta, stack: string[]): boolean {
    if (!stack.includes("nextjs")) return false;
    return /^(app|src\/app|pages|src\/pages)\//.test(file.path);
  },
  extract(ctx: ExtractCtx): Partial<IndexContribution> {
    const contribution = emptyContribution();
    const src = stripComments(ctx.source);
    const rel = ctx.file.path.replace(/^src\//, "");
    const routes: RouteEntry[] = [];

    if (/(^|\/)route\.(tsx?|jsx?)$/.test(rel)) {
      // App-router API route: methods = exported HTTP verb functions.
      const urlPath = appPagePath(rel);
      for (const verb of HTTP_VERBS) {
        const re = new RegExp(
          `export\\s+(?:async\\s+)?(?:function\\s+${verb}\\b|const\\s+${verb}\\b)`
        );
        if (re.exec(src)) {
          routes.push({ framework: "nextjs", method: verb, path: urlPath, file: ctx.file.path });
        }
      }
    } else if (/(^|\/)page\.(tsx?|jsx?)$/.test(rel)) {
      routes.push({
        framework: "nextjs",
        method: "GET",
        path: appPagePath(rel),
        file: ctx.file.path,
      });
    } else if (/^pages\/api\//.test(rel)) {
      routes.push({
        framework: "nextjs",
        method: "ALL",
        path: pagesPath(rel),
        file: ctx.file.path,
      });
    } else if (/^pages\//.test(rel) && !/^pages\/_/.test(rel)) {
      routes.push({
        framework: "nextjs",
        method: "GET",
        path: pagesPath(rel),
        file: ctx.file.path,
      });
    }

    contribution.routes = routes;
    // Mark client/server nothing extra here; react extractor handles components.
    void isClient;
    return contribution;
  },
};

export { isClient as nextIsClient };

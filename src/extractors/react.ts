import type { ComponentEntry } from "../schema/index-schema.js";
import {
  emptyContribution,
  stripComments,
  type ExtractCtx,
  type Extractor,
  type FileMeta,
  type IndexContribution,
} from "./types.js";
import { nextIsClient } from "./nextjs.js";

const JSX_EXTS = new Set(["tsx", "jsx"]);

function parseProps(param: string): string[] {
  const trimmed = param.trim();
  const brace = trimmed.match(/^\{([^}]*)\}/);
  if (!brace) return [];
  return brace[1]
    .split(",")
    .map((p) => p.trim().split(":")[0].split("=")[0].replace(/\.\.\./, "").trim())
    .filter((p) => /^[A-Za-z_$][\w$]*$/.test(p));
}

function collectHooks(src: string): string[] {
  const hooks = new Set<string>();
  const re = /\b(use[A-Z][\w$]*)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) hooks.add(m[1]);
  return [...hooks].sort();
}

export const reactExtractor: Extractor = {
  name: "react",
  appliesTo(file: FileMeta, stack: string[]): boolean {
    return stack.includes("react") || stack.includes("nextjs")
      ? JSX_EXTS.has(file.ext)
      : false;
  },
  extract(ctx: ExtractCtx): Partial<IndexContribution> {
    const contribution = emptyContribution();
    const src = stripComments(ctx.source);
    // Only treat as component file if it returns/contains JSX.
    if (!/<[A-Za-z]/.test(src) && !/return\s*\(/.test(src)) return contribution;

    const client = nextIsClient(ctx.source);
    const hooks = collectHooks(src);
    const components: ComponentEntry[] = [];
    const seen = new Set<string>();

    const add = (name: string, param: string) => {
      if (!/^[A-Z]/.test(name) || seen.has(name)) return;
      seen.add(name);
      components.push({
        name,
        file: ctx.file.path,
        props: parseProps(param),
        client,
        hooks: hooks.length ? hooks : undefined,
      });
    };

    // function Foo(props) { ... }
    const fnRe = /(?:export\s+)?(?:default\s+)?function\s+([A-Z][\w$]*)\s*\(([^)]*)\)/g;
    let m: RegExpExecArray | null;
    while ((m = fnRe.exec(src))) add(m[1], m[2]);

    // const Foo = (props) => ... / const Foo: FC = (props) =>
    const constRe =
      /(?:export\s+)?const\s+([A-Z][\w$]*)\s*(?::[^=]+)?=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)?\s*(?:\(([^)]*)\))?\s*(?::[^=]+)?=>/g;
    while ((m = constRe.exec(src))) add(m[1], m[2] ?? "");

    contribution.components = components;
    return contribution;
  },
};

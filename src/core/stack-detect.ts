import { existsSync } from "node:fs";
import { join } from "node:path";
import { readJson } from "./store.js";

const DEP_MAP: Record<string, string> = {
  next: "nextjs",
  express: "express",
  react: "react",
  "react-dom": "react",
  "@prisma/client": "prisma",
  prisma: "prisma",
  mongoose: "mongoose",
  "@supabase/supabase-js": "supabase",
};

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface StackInfo {
  stack: string[];
  projectName: string;
}

/** Detect frameworks from package.json deps + marker files in the repo root. */
export function detectStack(root: string): StackInfo {
  const found = new Set<string>();
  let projectName = "project";

  const pkgPath = join(root, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = readJson<PackageJson>(pkgPath);
      if (pkg.name) projectName = pkg.name;
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      for (const dep of Object.keys(deps)) {
        const mapped = DEP_MAP[dep];
        if (mapped) found.add(mapped);
      }
    } catch {
      /* ignore malformed package.json */
    }
  }

  // Marker files.
  if (existsSync(join(root, "prisma", "schema.prisma"))) found.add("prisma");
  if (existsSync(join(root, "supabase"))) found.add("supabase");
  if (
    existsSync(join(root, "next.config.js")) ||
    existsSync(join(root, "next.config.mjs")) ||
    existsSync(join(root, "next.config.ts"))
  ) {
    found.add("nextjs");
  }

  return { stack: [...found].sort(), projectName };
}

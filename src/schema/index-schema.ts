/**
 * Types + runtime validator for `.aicontext/index.json`.
 * Hand-rolled validation (no heavy schema lib) to keep the dependency
 * footprint tiny and the offline promise intact.
 */

export const SCHEMA_VERSION = 1 as const;

export type ExportKind =
  | "function"
  | "class"
  | "const"
  | "variable"
  | "type"
  | "interface"
  | "enum"
  | "default"
  | "component";

export interface ExportEntry {
  name: string;
  kind: ExportKind;
}

export interface FileEntry {
  path: string;
  hash: string;
  lang: string;
  /** AI-enriched one-liner; null until enriched. */
  purpose: string | null;
  /** true when the file hash changed since the purpose was last written. */
  purposeStale: boolean;
  exports: ExportEntry[];
  imports: string[];
}

export interface RouteEntry {
  framework: string;
  method: string;
  path: string;
  file: string;
}

export interface ComponentEntry {
  name: string;
  file: string;
  props: string[];
  client: boolean;
  hooks?: string[];
}

export interface PostgresTable {
  table: string;
  columns: string[];
  source: string;
}

export interface PrismaModel {
  model: string;
  fields: string[];
}

export interface MongoCollection {
  collection: string;
  fields: string[];
}

export interface DbSection {
  postgres: PostgresTable[];
  prisma: PrismaModel[];
  mongo: MongoCollection[];
}

export interface IndexStats {
  files: number;
  indexedFiles: number;
  loc: number;
}

export interface CodebaseIndex {
  schemaVersion: number;
  generatedAt: string;
  root: string;
  stack: string[];
  stats: IndexStats;
  files: FileEntry[];
  routes: RouteEntry[];
  components: ComponentEntry[];
  db: DbSection;
}

export function emptyIndex(root: string): CodebaseIndex {
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    root,
    stack: [],
    stats: { files: 0, indexedFiles: 0, loc: 0 },
    files: [],
    routes: [],
    components: [],
    db: { postgres: [], prisma: [], mongo: [] },
  };
}

/** Lightweight runtime validation. Returns list of problems (empty = valid). */
export function validateIndex(value: unknown): string[] {
  const problems: string[] = [];
  const isObj = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);

  if (!isObj(value)) return ["index is not an object"];

  if (value.schemaVersion !== SCHEMA_VERSION) {
    problems.push(
      `schemaVersion mismatch: expected ${SCHEMA_VERSION}, got ${String(value.schemaVersion)}`
    );
  }
  if (typeof value.generatedAt !== "string") problems.push("generatedAt must be a string");
  if (typeof value.root !== "string") problems.push("root must be a string");
  if (!Array.isArray(value.stack)) problems.push("stack must be an array");
  if (!Array.isArray(value.files)) problems.push("files must be an array");
  if (!Array.isArray(value.routes)) problems.push("routes must be an array");
  if (!Array.isArray(value.components)) problems.push("components must be an array");
  if (!isObj(value.db)) problems.push("db must be an object");
  if (!isObj(value.stats)) problems.push("stats must be an object");

  if (Array.isArray(value.files)) {
    value.files.forEach((f, i) => {
      if (!isObj(f)) {
        problems.push(`files[${i}] is not an object`);
        return;
      }
      if (typeof f.path !== "string") problems.push(`files[${i}].path must be a string`);
      if (typeof f.hash !== "string") problems.push(`files[${i}].hash must be a string`);
      if (!Array.isArray(f.exports)) problems.push(`files[${i}].exports must be an array`);
      if (!Array.isArray(f.imports)) problems.push(`files[${i}].imports must be an array`);
    });
  }

  return problems;
}

export function isValidIndex(value: unknown): value is CodebaseIndex {
  return validateIndex(value).length === 0;
}

import type { PrismaModel } from "../schema/index-schema.js";
import {
  emptyContribution,
  type ExtractCtx,
  type Extractor,
  type FileMeta,
  type IndexContribution,
} from "./types.js";

export const prismaExtractor: Extractor = {
  name: "prisma",
  appliesTo(file: FileMeta): boolean {
    return file.ext === "prisma";
  },
  extract(ctx: ExtractCtx): Partial<IndexContribution> {
    const contribution = emptyContribution();
    const models: PrismaModel[] = [];
    const blockRe = /model\s+([A-Za-z_][\w]*)\s*\{([^}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = blockRe.exec(ctx.source))) {
      const name = m[1];
      const body = m[2];
      const fields: string[] = [];
      for (const line of body.split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("//") || t.startsWith("@@")) continue;
        const fm = t.match(/^([A-Za-z_][\w]*)\s+\S+/);
        if (fm) fields.push(fm[1]);
      }
      models.push({ model: name, fields });
    }
    contribution.prisma = models;
    return contribution;
  },
};

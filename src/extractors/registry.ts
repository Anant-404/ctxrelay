import type { AbConfig } from "../core/store.js";
import { expressExtractor } from "./express.js";
import { jsTsExtractor } from "./js-ts.js";
import { mongooseExtractor } from "./mongoose.js";
import { nextjsExtractor } from "./nextjs.js";
import { prismaExtractor } from "./prisma.js";
import { reactExtractor } from "./react.js";
import { sqlExtractor } from "./sql.js";
import { supabaseExtractor } from "./supabase.js";
import type { Extractor } from "./types.js";

/** All extractors, base first. Order affects nothing but readability. */
const ALL: Extractor[] = [
  jsTsExtractor,
  nextjsExtractor,
  expressExtractor,
  reactExtractor,
  prismaExtractor,
  sqlExtractor,
  supabaseExtractor,
  mongooseExtractor,
];

/** Extractors enabled after applying config toggles. */
export function activeExtractors(config: AbConfig): Extractor[] {
  const toggles = config.extractors ?? {};
  return ALL.filter((e) => toggles[e.name] !== false);
}

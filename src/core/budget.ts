/**
 * Rough token budgeting. Uses the chars/4 heuristic — no tokenizer dependency,
 * good enough to keep the context bundle roughly constant-size.
 */

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** A named, priority-ordered chunk of the context bundle. */
export interface Section {
  /** lower number = higher priority (kept longest) */
  priority: number;
  name: string;
  render(): string;
  /** optional collapsed render used when the full one is over budget */
  collapse?(): string;
}

/**
 * Assemble sections under a token budget. Sections are added in priority order;
 * when the running total would exceed the budget, the section's collapsed
 * render is tried, then the section is dropped (lowest priority first).
 */
export function assemble(sections: Section[], budget: number): { text: string; tokens: number } {
  const ordered = [...sections].sort((a, b) => a.priority - b.priority);
  const pieces: string[] = [];
  let tokens = 0;

  for (const section of ordered) {
    const full = section.render().trim();
    if (!full) continue;
    const fullTokens = estimateTokens(full);
    if (tokens + fullTokens <= budget) {
      pieces.push(full);
      tokens += fullTokens;
      continue;
    }
    // Over budget: try collapsed form.
    if (section.collapse) {
      const collapsed = section.collapse().trim();
      const cTokens = estimateTokens(collapsed);
      if (collapsed && tokens + cTokens <= budget) {
        pieces.push(collapsed);
        tokens += cTokens;
        continue;
      }
    }
    // Otherwise drop this section.
  }

  const text = pieces.join("\n\n");
  return { text, tokens: estimateTokens(text) };
}

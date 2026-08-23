// docs-pack/prompts/email-generation.md: "Default first-touch email target:
// 120-180 words. Longer only when the opportunity demands it." Enforced as
// a hard sanity bound (not the exact 120-180 target, which is a guideline
// the prompt itself is instructed to follow) — anything wildly outside
// this range indicates a malformed or runaway generation and fails closed
// rather than being sent for approval as-is.
const HARD_MIN_WORDS = 40;
const HARD_MAX_WORDS = 400;
const TARGET_MIN_WORDS = 120;
const TARGET_MAX_WORDS = 180;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export interface WordCountCheck {
  count: number;
  withinHardBounds: boolean;
  withinTarget: boolean;
}

export function checkWordCount(text: string): WordCountCheck {
  const count = countWords(text);
  return {
    count,
    withinHardBounds: count >= HARD_MIN_WORDS && count <= HARD_MAX_WORDS,
    withinTarget: count >= TARGET_MIN_WORDS && count <= TARGET_MAX_WORDS,
  };
}

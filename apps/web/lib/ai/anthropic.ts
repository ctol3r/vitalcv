/**
 * Anthropic (Claude) config — the single, documented gate for VitalCV's optional
 * AI features.
 *
 * AI is OFF unless `ANTHROPIC_API_KEY` is set. Every AI feature MUST degrade
 * honestly when `isAnthropicConfigured()` is false — the deterministic path keeps
 * working, the UI says AI isn't enabled, and nothing is fabricated or errored.
 *
 * Today this gates the MATCHA cover-letter drafter. The planned LLM
 * match-explanation / re-ranking layer will import the same gate, so turning AI
 * on across the product is a single env var with no code change.
 *
 * Env (set in the Railway *web* service Variables — never commit a key):
 *   ANTHROPIC_API_KEY   enables AI. Create one at https://console.anthropic.com/.
 *   COVER_LETTER_MODEL  optional model override (default below).
 */

export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_VERSION = '2023-06-01';
export const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-4-8';

/** The configured key, or undefined when AI is not enabled in this environment. */
export function getAnthropicKey(): string | undefined {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  return key && key.length > 0 ? key : undefined;
}

/** True when a model key is present — the gate every AI feature checks first. */
export function isAnthropicConfigured(): boolean {
  return getAnthropicKey() !== undefined;
}

/** The model to call, honoring COVER_LETTER_MODEL, else the default. */
export function anthropicModel(): string {
  return process.env.COVER_LETTER_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;
}

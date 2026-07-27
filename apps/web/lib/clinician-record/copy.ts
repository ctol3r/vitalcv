/**
 * copy.ts — the honesty strings, held as constants rather than inline JSX.
 *
 * These sentences are load-bearing: they are what stops a complete-looking
 * provider record from reading as a credential check. Inline in JSX they are
 * invisible to a guard (the compiler wraps prose across lines, so grepping the
 * source for a phrase is unreliable) and easy to soften during a copy pass —
 * a failure this repo has seen before, where polish quietly dropped a
 * truth-contract string.
 *
 * As constants they can be asserted directly, and any edit shows up in a diff
 * against a test that states what the sentence has to establish.
 */

/**
 * Shown above the record on the public, indexable provider page.
 *
 * That page is reached from search with no surrounding context, so what it is
 * NOT has to be stated before the data rather than inferred from it.
 */
export const DIRECTORY_CONTEXT_NOTE =
  'This page republishes what this provider filed with CMS. It is not a background check, a licence check, or a credentialing decision. CMS does not confirm these details with any licensing board before publishing them, and the section at the foot of this page lists what the filing does not cover.';

/** Shown to a clinician above their own record. */
export const OWNER_CONTEXT_NOTE =
  'Your CMS filing, shown as it appears on your public record. Anything wrong here is corrected at CMS, not on this page.';

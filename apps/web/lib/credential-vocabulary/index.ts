/**
 * Credential vocabulary barrel — the preset post-nominal system (K2).
 * "Jane Q. Smith, MD, MPH, FACC" is a render, never a stored string.
 */

export type {
  CredentialKind,
  CredentialVerifiability,
  ProfessionScope,
  CredentialIssuer,
  CredentialDef,
  OrderingProfileId,
  OrderingProfile,
  HeldCredential,
  RenderedPostNominals,
} from './types';
export { CREDENTIAL_ISSUERS } from './issuers';
export { CREDENTIAL_DEFS, COURSE_COMPLETION_BLOCKLIST } from './definitions';
export {
  ORDERING_PROFILES,
  getCredentialDef,
  ambiguousTokens,
  renderPostNominals,
} from './ordering';

/**
 * Tokens known to be legitimately held by multiple issuers. Every ambiguous
 * token in CREDENTIAL_DEFS must appear here (test-enforced both directions) —
 * an undeclared collision is a curation error, and a declared one drives the
 * "which academy?" disambiguation UX.
 */
export const KNOWN_COLLISION_TOKENS: readonly string[] = ['FAAN', 'FCCP', 'FAAO'];

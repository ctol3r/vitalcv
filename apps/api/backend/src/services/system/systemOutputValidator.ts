import type { OmegaResponse } from '../../orchestrator/vcv-omega';

export class SystemOutputPrecisionError extends Error {
  readonly violations: OutputPrecisionViolation[];

  constructor(violations: OutputPrecisionViolation[]) {
    super(`Truth precision violation: ${violations[0]?.code ?? 'unknown'}`);
    this.name = 'SystemOutputPrecisionError';
    this.violations = violations;
  }
}

export interface OutputPrecisionViolation {
  code:
    | 'ambiguous_independent_claim'
    | 'ambiguous_real_time_claim'
    | 'verified_when_inferred'
    | 'unprovable_cryptographic_claim'
    | 'unprovable_blockchain_claim'
    | 'unprovable_security_claim'
    | 'unprovable_trustless_claim'
    | 'contextual_claim_requires_evidence';
  path: string;
  value: string;
}

export interface ClaimValidationContext {
  supportingEvidence?: boolean;
}

export type OmegaDecisionObject = OmegaResponse;

type ClaimType =
  | 'cryptographic'
  | 'blockchain'
  | 'trustless'
  | 'security'
  | 'secure_contextual'
  | 'trusted_contextual'
  | 'reliable_contextual';

const INFERENCE_MARKERS = [
  'inferred',
  'estimated',
  'predicted',
  'modeled',
  'derived',
  'heuristic',
  'assumed',
  'likely',
  'probable',
  'confidence',
  'score',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isNullableRecord(value: unknown): value is Record<string, unknown> | null {
  return value === null || isRecord(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isOptionalNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || isNullableString(value);
}

function normalizeSingleSystemOutput(value: unknown): unknown {
  if (Array.isArray(value)) {
    if (value.length > 1) {
      throw new Error('Multiple system outputs detected');
    }
    return value[0] ?? null;
  }

  if (!isRecord(value)) {
    return value;
  }

  const multiOutputKeys = ['outputs', 'results', 'responses', 'decisions'] as const;
  for (const key of multiOutputKeys) {
    const candidate = value[key];
    if (!Array.isArray(candidate)) {
      continue;
    }

    if (candidate.length > 1) {
      throw new Error('Multiple system outputs detected');
    }

    if (candidate.length === 1) {
      return candidate[0] ?? null;
    }
  }

  return value;
}

function isOmegaStatus(value: unknown): value is OmegaDecisionObject['status'] {
  return value === 'ok' || value === 'not_found' || value === 'partial';
}

export function assertOmegaDecisionObject(value: unknown): OmegaDecisionObject {
  const candidate = normalizeSingleSystemOutput(value);

  if (!isRecord(candidate)) {
    throw new TypeError('OmegaDecisionObject required');
  }

  if (!isOmegaStatus(candidate.status)) {
    throw new TypeError('OmegaDecisionObject required');
  }

  if (!isRecord(candidate.subject) || typeof candidate.subject.npi !== 'string') {
    throw new TypeError('OmegaDecisionObject required');
  }

  if (
    !isRecord(candidate.context)
    || !isOptionalNullableString(candidate.context.orgId)
    || !isOptionalNullableString(candidate.context.role)
    || !isBoolean(candidate.context.persist)
  ) {
    throw new TypeError('OmegaDecisionObject required');
  }

  if (typeof candidate.generatedAt !== 'string') {
    throw new TypeError('OmegaDecisionObject required');
  }

  if (!Array.isArray(candidate.recent_actions)) {
    throw new TypeError('OmegaDecisionObject required');
  }

  if (
    !('decision' in candidate)
    || !('coverage' in candidate)
    || !('claims' in candidate)
    || !('reuse_signal' in candidate)
    || !('acceptance' in candidate)
    || !('activation' in candidate)
    || !('drift' in candidate)
    || !('nextBestAction' in candidate)
  ) {
    throw new TypeError('OmegaDecisionObject required');
  }

  if (
    !isNullableRecord(candidate.decision)
    || !isNullableRecord(candidate.coverage)
    || !isNullableRecord(candidate.claims)
    || !isNullableRecord(candidate.reuse_signal)
    || !isNullableRecord(candidate.acceptance)
    || !isNullableRecord(candidate.activation)
    || !isNullableRecord(candidate.drift)
    || !isNullableRecord(candidate.nextBestAction)
  ) {
    throw new TypeError('OmegaDecisionObject required');
  }

  return candidate as unknown as OmegaDecisionObject;
}

function pushViolation(
  violations: OutputPrecisionViolation[],
  violation: OutputPrecisionViolation,
): void {
  violations.push(violation);
}

function tokenizeWords(value: string): string[] {
  const matches = value.toLowerCase().match(/[a-z0-9]+/g);
  return matches ? [...matches] : [];
}

function hasToken(tokens: ReadonlySet<string>, token: string): boolean {
  return tokens.has(token);
}

function matchesSequence(tokens: readonly string[], sequence: readonly string[], start: number): boolean {
  if (start + sequence.length > tokens.length) {
    return false;
  }

  for (let index = 0; index < sequence.length; index += 1) {
    if (tokens[start + index] !== sequence[index]) {
      return false;
    }
  }

  return true;
}

function containsSequence(tokens: readonly string[], sequence: readonly string[]): boolean {
  for (let index = 0; index < tokens.length; index += 1) {
    if (matchesSequence(tokens, sequence, index)) {
      return true;
    }
  }

  return false;
}

function classifyClaimTypes(tokens: readonly string[]): Set<ClaimType> {
  const tokenSet = new Set(tokens);
  const claimTypes = new Set<ClaimType>();

  if (
    hasToken(tokenSet, 'crypto')
    || hasToken(tokenSet, 'cryptography')
    || hasToken(tokenSet, 'cryptographic')
    || hasToken(tokenSet, 'cryptographically')
  ) {
    claimTypes.add('cryptographic');
  }

  if (hasToken(tokenSet, 'blockchain') || containsSequence(tokens, ['block', 'chain'])) {
    claimTypes.add('blockchain');
  }

  if (hasToken(tokenSet, 'trustless') || containsSequence(tokens, ['trust', 'less'])) {
    claimTypes.add('trustless');
  }

  if (containsSequence(tokens, ['provably', 'secure'])) {
    claimTypes.add('security');
  }

  if (hasToken(tokenSet, 'secure') || hasToken(tokenSet, 'securely')) {
    claimTypes.add('secure_contextual');
  }

  if (hasToken(tokenSet, 'trusted')) {
    claimTypes.add('trusted_contextual');
  }

  if (hasToken(tokenSet, 'reliable') || hasToken(tokenSet, 'reliably')) {
    claimTypes.add('reliable_contextual');
  }

  return claimTypes;
}

function classifyNegatedClaims(tokens: readonly string[]): Set<ClaimType> {
  const negated = new Set<ClaimType>();
  const claimSequences: Array<{ type: ClaimType; sequence: readonly string[] }> = [
    { type: 'cryptographic', sequence: ['cryptography'] },
    { type: 'cryptographic', sequence: ['cryptographic'] },
    { type: 'cryptographic', sequence: ['cryptographically'] },
    { type: 'cryptographic', sequence: ['crypto'] },
    { type: 'blockchain', sequence: ['blockchain'] },
    { type: 'blockchain', sequence: ['block', 'chain'] },
    { type: 'trustless', sequence: ['trustless'] },
    { type: 'trustless', sequence: ['trust', 'less'] },
    { type: 'secure_contextual', sequence: ['secure'] },
    { type: 'secure_contextual', sequence: ['securely'] },
    { type: 'trusted_contextual', sequence: ['trusted'] },
    { type: 'reliable_contextual', sequence: ['reliable'] },
    { type: 'reliable_contextual', sequence: ['reliably'] },
  ];
  const negationPrefixes: Array<readonly string[]> = [
    ['no'],
    ['without'],
    ['not'],
  ];

  for (let index = 0; index < tokens.length; index += 1) {
    for (const prefix of negationPrefixes) {
      if (!matchesSequence(tokens, prefix, index)) {
        continue;
      }

      const claimStart = index + prefix.length;
      for (const claim of claimSequences) {
        if (matchesSequence(tokens, claim.sequence, claimStart)) {
          negated.add(claim.type);
        }
      }
    }
  }

  return negated;
}

function collectClaimViolations(
  value: string,
  path: string,
  context: ClaimValidationContext,
): OutputPrecisionViolation[] {
  const violations: OutputPrecisionViolation[] = [];
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return violations;
  }

  const tokens = tokenizeWords(value);
  const claimTypes = classifyClaimTypes(tokens);
  const negatedClaimTypes = classifyNegatedClaims(tokens);

  if (
    claimTypes.has('cryptographic')
    && !negatedClaimTypes.has('cryptographic')
  ) {
    pushViolation(violations, {
      code: 'unprovable_cryptographic_claim',
      path,
      value,
    });
  }

  if (
    claimTypes.has('blockchain')
    && !negatedClaimTypes.has('blockchain')
  ) {
    pushViolation(violations, {
      code: 'unprovable_blockchain_claim',
      path,
      value,
    });
  }

  if (claimTypes.has('security')) {
    pushViolation(violations, {
      code: 'unprovable_security_claim',
      path,
      value,
    });
  }

  if (
    claimTypes.has('trustless')
    && !negatedClaimTypes.has('trustless')
  ) {
    pushViolation(violations, {
      code: 'unprovable_trustless_claim',
      path,
      value,
    });
  }

  const contextualClaimTypes: ClaimType[] = [
    'secure_contextual',
    'trusted_contextual',
    'reliable_contextual',
  ];

  for (const claimType of contextualClaimTypes) {
    if (
      claimTypes.has(claimType)
      && !negatedClaimTypes.has(claimType)
      && context.supportingEvidence !== true
    ) {
      pushViolation(violations, {
        code: 'contextual_claim_requires_evidence',
        path,
        value,
      });
    }
  }

  return violations;
}

export function validateClaim(
  text: string,
  context: ClaimValidationContext = {},
): string {
  const violations = collectClaimViolations(text, 'claim', context);
  if (violations.length > 0) {
    throw new SystemOutputPrecisionError(violations);
  }

  return text;
}

function validateStringValue(
  value: string,
  path: string,
  violations: OutputPrecisionViolation[],
): void {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return;
  }
  const tokens = tokenizeWords(value);
  const tokenSet = new Set(tokens);

  for (const violation of collectClaimViolations(value, path, {})) {
    pushViolation(violations, violation);
  }

  if (/\bindependent\b/.test(normalized)) {
    pushViolation(violations, {
      code: 'ambiguous_independent_claim',
      path,
      value,
    });
  }

  if (/\breal[\s-]?time\b/.test(normalized)) {
    pushViolation(violations, {
      code: 'ambiguous_real_time_claim',
      path,
      value,
    });
  }

  if (
    /\bverified\b/.test(normalized)
    && INFERENCE_MARKERS.some((marker) => hasToken(tokenSet, marker))
  ) {
    pushViolation(violations, {
      code: 'verified_when_inferred',
      path,
      value,
    });
  }
}

function walkOutput(
  value: unknown,
  path: string,
  violations: OutputPrecisionViolation[],
): void {
  if (typeof value === 'string') {
    validateStringValue(value, path, violations);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      walkOutput(entry, `${path}[${index}]`, violations);
    });
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  Object.entries(value).forEach(([key, entry]) => {
    walkOutput(entry, path ? `${path}.${key}` : key, violations);
  });
}

export function validateSystemOutput<T>(output: T): T {
  const violations: OutputPrecisionViolation[] = [];
  walkOutput(output, 'output', violations);

  if (violations.length > 0) {
    throw new SystemOutputPrecisionError(violations);
  }

  return output;
}

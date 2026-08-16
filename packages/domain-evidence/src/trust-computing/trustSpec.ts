/**
 * TrustSpec 0.1 — pure, versioned, machine-readable institutional requirement
 * sets, plus fail-closed structural validation (PTC Wave P1).
 *
 * Scope and discipline (per docs/trust-computing/PTC_ARCHITECTURE_MAP.md):
 *
 * - PURE TRANSFORMS ONLY. No Prisma, no HTTP, no React, no persistence, and no
 *   clock reads — `Date.now()` is forbidden here. `FRESH_WITHIN` stores a
 *   freshness *window*; any comparison against real time happens in a later
 *   evaluator that receives its evaluation timestamp as an explicit input.
 * - SATISFIED NEVER MEANS ACCEPTED. A TrustSpec, a validation pass, or any
 *   future SATISFIED evaluation result records only that supplied evidence met
 *   a machine-readable policy predicate. It does not record, imply, grant, or
 *   accelerate an employer decision, an acceptance, a recognition, or a start.
 *   Institutional acceptance is recorded exclusively by the canonical employer
 *   decision services (`employerWorkflowService` /
 *   `applicationStartCommandService`); nothing in this module may be presented
 *   as, or feed a surface that presents, an acceptance.
 * - FAIL CLOSED. Unknown schema versions, unknown operators, unknown evidence
 *   classes, unknown necessity values, and unknown object keys are rejected —
 *   never skipped, defaulted, or repaired. Validation never infers policy
 *   intent from labels.
 * - This module carries both the 0.1 contract and `validateTrustSpec()` (the
 *   remit the architecture map assigns to `validateTrustSpec.ts`); the file
 *   split becomes mechanical when the compiler modules arrive in later waves.
 *
 * No consumer imports this module yet: additive and unreferenced is the
 * correct state for Wave P1.
 */

import type { EvidenceClass } from '../types';
import { EVIDENCE_CLASSES } from '../collection';

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

/** The only schema version this validator accepts. Unknown versions reject. */
export const TRUST_SPEC_SCHEMA_VERSION = '0.1' as const;
export type TrustSpecSchemaVersion = typeof TRUST_SPEC_SCHEMA_VERSION;

/** The complete, closed operator set for TrustSpec 0.1. */
export const TRUST_SPEC_OPERATORS = [
  'EVIDENCE_EXISTS',
  'VALUE_EQUALS',
  'VALUE_IN',
  'COUNT_AT_LEAST',
  'SOURCE_IN',
  'FRESH_WITHIN',
  'JURISDICTION_EQUALS',
  'ALL_OF',
  'ANY_OF',
  'NOT',
  'MANUAL_REVIEW',
] as const;
export type TrustSpecOperator = (typeof TRUST_SPEC_OPERATORS)[number];

/** Primitive literal usable in VALUE_EQUALS / VALUE_IN. Numbers must be finite. */
export type TrustSpecValueLiteral = string | number | boolean;

/** Evidence of the named class exists for the subject. Existence, not quality. */
export interface EvidenceExistsCondition {
  readonly operator: 'EVIDENCE_EXISTS';
  readonly evidenceClass: EvidenceClass;
}

/** A named evidence field equals the expected literal exactly. */
export interface ValueEqualsCondition {
  readonly operator: 'VALUE_EQUALS';
  readonly fieldPath: string;
  readonly expected: TrustSpecValueLiteral;
}

/** A named evidence field's value is a member of the allowed set. */
export interface ValueInCondition {
  readonly operator: 'VALUE_IN';
  readonly fieldPath: string;
  readonly allowed: readonly TrustSpecValueLiteral[];
}

/** At least `minimumCount` decision-grade evidence objects of the class exist. */
export interface CountAtLeastCondition {
  readonly operator: 'COUNT_AT_LEAST';
  readonly evidenceClass: EvidenceClass;
  readonly minimumCount: number;
}

/**
 * The satisfying evidence must come from one of the named sources. Source IDs
 * are validated for shape only; registry-identity reconciliation (RQ-04) is a
 * separate, explicit decision — shape validity here asserts nothing about a
 * source's existence or capability.
 */
export interface SourceInCondition {
  readonly operator: 'SOURCE_IN';
  readonly sourceIds: readonly string[];
}

/**
 * The satisfying evidence must have been observed within `maxAgeHours` of the
 * evaluation timestamp — a timestamp the future evaluator receives as input.
 * The spec stores only the window; this module never reads a clock.
 */
export interface FreshWithinCondition {
  readonly operator: 'FRESH_WITHIN';
  readonly maxAgeHours: number;
}

/** The satisfying evidence's jurisdiction equals this value exactly. */
export interface JurisdictionEqualsCondition {
  readonly operator: 'JURISDICTION_EQUALS';
  readonly jurisdiction: string;
}

/** Every child condition must hold. Commutative; children may not be empty. */
export interface AllOfCondition {
  readonly operator: 'ALL_OF';
  readonly conditions: readonly TrustSpecCondition[];
}

/** At least one child condition must hold. Commutative; children may not be empty. */
export interface AnyOfCondition {
  readonly operator: 'ANY_OF';
  readonly conditions: readonly TrustSpecCondition[];
}

/** The child condition must not hold. */
export interface NotCondition {
  readonly operator: 'NOT';
  readonly condition: TrustSpecCondition;
}

/**
 * The requirement can never be established computationally: it always requires
 * an institution-scoped human review. A requirement containing MANUAL_REVIEW
 * can at best evaluate to REVIEW_REQUIRED — never to SATISFIED.
 */
export interface ManualReviewCondition {
  readonly operator: 'MANUAL_REVIEW';
  /** Optional non-empty note naming what the reviewer must establish. */
  readonly note?: string;
}

export type TrustSpecCondition =
  | EvidenceExistsCondition
  | ValueEqualsCondition
  | ValueInCondition
  | CountAtLeastCondition
  | SourceInCondition
  | FreshWithinCondition
  | JurisdictionEqualsCondition
  | AllOfCondition
  | AnyOfCondition
  | NotCondition
  | ManualReviewCondition;

/** One institutional requirement inside a TrustSpec. */
export interface TrustSpecRequirement {
  readonly requirementId: string;
  readonly label: string;
  readonly necessity: 'mandatory' | 'preferred';
  readonly condition: TrustSpecCondition;
  /** Requirement IDs (within the same spec) that must be evaluated first. */
  readonly dependsOn: readonly string[];
}

/** A versioned, machine-readable institutional requirement set. */
export interface TrustSpec {
  readonly schemaVersion: TrustSpecSchemaVersion;
  readonly specId: string;
  /** Positive integer, owned by the authoring adapter. Explicit, never inferred. */
  readonly specVersion: number;
  readonly organizationKey: string;
  readonly title: string;
  readonly requirements: readonly TrustSpecRequirement[];
}

// ---------------------------------------------------------------------------
// Validation result contract
// ---------------------------------------------------------------------------

export const TRUST_SPEC_VALIDATION_ERROR_CODES = [
  'SPEC_SHAPE_INVALID',
  'SCHEMA_VERSION_UNSUPPORTED',
  'SPEC_ID_MALFORMED',
  'SPEC_VERSION_NOT_POSITIVE_INTEGER',
  'ORGANIZATION_KEY_MALFORMED',
  'TITLE_EMPTY',
  'REQUIREMENTS_EMPTY',
  'REQUIREMENT_SHAPE_INVALID',
  'REQUIREMENT_ID_MALFORMED',
  'REQUIREMENT_ID_DUPLICATE',
  'REQUIREMENT_LABEL_EMPTY',
  'NECESSITY_UNKNOWN',
  'DEPENDENCY_MALFORMED',
  'DEPENDENCY_DUPLICATE',
  'DEPENDENCY_SELF',
  'DEPENDENCY_UNRESOLVED',
  'DEPENDENCY_CYCLE',
  'CONDITION_SHAPE_INVALID',
  'OPERATOR_UNKNOWN',
  'EVIDENCE_CLASS_UNKNOWN',
  'FIELD_PATH_MALFORMED',
  'VALUE_LITERAL_INVALID',
  'VALUE_SET_EMPTY',
  'COUNT_NOT_POSITIVE_INTEGER',
  'SOURCE_SET_EMPTY',
  'SOURCE_ID_MALFORMED',
  'FRESHNESS_WINDOW_INVALID',
  'JURISDICTION_MALFORMED',
  'COMPOSITE_CHILDREN_EMPTY',
  'CONDITION_DEPTH_EXCEEDED',
  'CONDITION_CYCLE',
  'CONDITION_CONTRADICTION',
] as const;
export type TrustSpecValidationErrorCode =
  (typeof TRUST_SPEC_VALIDATION_ERROR_CODES)[number];

export interface TrustSpecValidationError {
  readonly code: TrustSpecValidationErrorCode;
  /** JSON-pointer-style path into the candidate document ('' = root). */
  readonly path: string;
  readonly message: string;
}

export type TrustSpecValidationResult =
  | { readonly valid: true; readonly spec: TrustSpec; readonly errors: readonly [] }
  | {
      readonly valid: false;
      readonly spec: null;
      readonly errors: readonly TrustSpecValidationError[];
    };

/** Maximum condition-tree nesting depth accepted by the validator. */
export const MAX_CONDITION_DEPTH = 32;

// ---------------------------------------------------------------------------
// Well-formedness rules (documented, exact)
// ---------------------------------------------------------------------------

/** IDs: 1–128 chars, start alphanumeric, then alphanumeric or [._:-]. */
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
/** Field paths: dot-separated word segments, e.g. `status`, `value.jurisdiction`. */
const FIELD_PATH_PATTERN = /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/;
const MAX_FIELD_PATH_LENGTH = 256;
const MAX_JURISDICTION_LENGTH = 64;

function isWellFormedId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== null
  );
}

function isValueLiteral(value: unknown): value is TrustSpecValueLiteral {
  return (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

const EVIDENCE_CLASS_SET: ReadonlySet<string> = new Set(EVIDENCE_CLASSES);
const OPERATOR_SET: ReadonlySet<string> = new Set(TRUST_SPEC_OPERATORS);

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

interface ErrorCollector {
  push(code: TrustSpecValidationErrorCode, path: string, message: string): void;
}

/** Allowed keys per condition operator; anything else is fail-closed rejected. */
const CONDITION_KEYS: Readonly<Record<TrustSpecOperator, readonly string[]>> = {
  EVIDENCE_EXISTS: ['operator', 'evidenceClass'],
  VALUE_EQUALS: ['operator', 'fieldPath', 'expected'],
  VALUE_IN: ['operator', 'fieldPath', 'allowed'],
  COUNT_AT_LEAST: ['operator', 'evidenceClass', 'minimumCount'],
  SOURCE_IN: ['operator', 'sourceIds'],
  FRESH_WITHIN: ['operator', 'maxAgeHours'],
  JURISDICTION_EQUALS: ['operator', 'jurisdiction'],
  ALL_OF: ['operator', 'conditions'],
  ANY_OF: ['operator', 'conditions'],
  NOT: ['operator', 'condition'],
  MANUAL_REVIEW: ['operator', 'note'],
};

/**
 * Validates one condition subtree. Returns true when the subtree is
 * structurally clean (safe for contradiction analysis).
 */
function validateCondition(
  node: unknown,
  path: string,
  depth: number,
  visited: Set<object>,
  errors: ErrorCollector,
): boolean {
  if (depth > MAX_CONDITION_DEPTH) {
    errors.push(
      'CONDITION_DEPTH_EXCEEDED',
      path,
      `condition nesting exceeds the maximum depth of ${MAX_CONDITION_DEPTH}`,
    );
    return false;
  }
  if (!isPlainObject(node)) {
    errors.push('CONDITION_SHAPE_INVALID', path, 'condition must be a plain object');
    return false;
  }
  if (visited.has(node)) {
    errors.push(
      'CONDITION_CYCLE',
      path,
      'condition tree references the same object node more than once',
    );
    return false;
  }
  visited.add(node);

  const operator = node['operator'];
  if (typeof operator !== 'string' || !OPERATOR_SET.has(operator)) {
    errors.push(
      'OPERATOR_UNKNOWN',
      `${path}/operator`,
      `unknown operator ${JSON.stringify(operator)}; TrustSpec 0.1 operators are: ${TRUST_SPEC_OPERATORS.join(', ')}`,
    );
    return false;
  }
  const op = operator as TrustSpecOperator;

  let clean = true;
  const allowedKeys = CONDITION_KEYS[op];
  for (const key of Object.keys(node).sort()) {
    if (!allowedKeys.includes(key)) {
      errors.push(
        'CONDITION_SHAPE_INVALID',
        `${path}/${key}`,
        `unexpected key ${JSON.stringify(key)} on ${op} condition`,
      );
      clean = false;
    }
  }

  switch (op) {
    case 'EVIDENCE_EXISTS':
    case 'COUNT_AT_LEAST': {
      const evidenceClass = node['evidenceClass'];
      if (typeof evidenceClass !== 'string' || !EVIDENCE_CLASS_SET.has(evidenceClass)) {
        errors.push(
          'EVIDENCE_CLASS_UNKNOWN',
          `${path}/evidenceClass`,
          `unknown evidence class ${JSON.stringify(evidenceClass)}`,
        );
        clean = false;
      }
      if (op === 'COUNT_AT_LEAST') {
        const minimumCount = node['minimumCount'];
        if (
          typeof minimumCount !== 'number' ||
          !Number.isInteger(minimumCount) ||
          minimumCount < 1
        ) {
          errors.push(
            'COUNT_NOT_POSITIVE_INTEGER',
            `${path}/minimumCount`,
            'minimumCount must be a positive integer',
          );
          clean = false;
        }
      }
      break;
    }
    case 'VALUE_EQUALS':
    case 'VALUE_IN': {
      const fieldPath = node['fieldPath'];
      if (
        typeof fieldPath !== 'string' ||
        fieldPath.length > MAX_FIELD_PATH_LENGTH ||
        !FIELD_PATH_PATTERN.test(fieldPath)
      ) {
        errors.push(
          'FIELD_PATH_MALFORMED',
          `${path}/fieldPath`,
          'fieldPath must be dot-separated word segments (e.g. "value.jurisdiction")',
        );
        clean = false;
      }
      if (op === 'VALUE_EQUALS') {
        if (!isValueLiteral(node['expected'])) {
          errors.push(
            'VALUE_LITERAL_INVALID',
            `${path}/expected`,
            'expected must be a string, boolean, or finite number',
          );
          clean = false;
        }
      } else {
        const allowed = node['allowed'];
        if (!Array.isArray(allowed)) {
          errors.push(
            'CONDITION_SHAPE_INVALID',
            `${path}/allowed`,
            'allowed must be an array',
          );
          clean = false;
        } else if (allowed.length === 0) {
          errors.push(
            'VALUE_SET_EMPTY',
            `${path}/allowed`,
            'allowed must contain at least one literal',
          );
          clean = false;
        } else {
          allowed.forEach((member, index) => {
            if (!isValueLiteral(member)) {
              errors.push(
                'VALUE_LITERAL_INVALID',
                `${path}/allowed/${index}`,
                'allowed members must be strings, booleans, or finite numbers',
              );
              clean = false;
            }
          });
        }
      }
      break;
    }
    case 'SOURCE_IN': {
      const sourceIds = node['sourceIds'];
      if (!Array.isArray(sourceIds)) {
        errors.push(
          'CONDITION_SHAPE_INVALID',
          `${path}/sourceIds`,
          'sourceIds must be an array',
        );
        clean = false;
      } else if (sourceIds.length === 0) {
        errors.push(
          'SOURCE_SET_EMPTY',
          `${path}/sourceIds`,
          'sourceIds must contain at least one source ID',
        );
        clean = false;
      } else {
        sourceIds.forEach((sourceId, index) => {
          if (!isWellFormedId(sourceId)) {
            errors.push(
              'SOURCE_ID_MALFORMED',
              `${path}/sourceIds/${index}`,
              'source IDs must be 1-128 chars, alphanumeric plus [._:-], starting alphanumeric',
            );
            clean = false;
          }
        });
      }
      break;
    }
    case 'FRESH_WITHIN': {
      const maxAgeHours = node['maxAgeHours'];
      if (
        typeof maxAgeHours !== 'number' ||
        !Number.isFinite(maxAgeHours) ||
        maxAgeHours <= 0
      ) {
        errors.push(
          'FRESHNESS_WINDOW_INVALID',
          `${path}/maxAgeHours`,
          'maxAgeHours must be a finite number greater than zero',
        );
        clean = false;
      }
      break;
    }
    case 'JURISDICTION_EQUALS': {
      const jurisdiction = node['jurisdiction'];
      if (
        typeof jurisdiction !== 'string' ||
        jurisdiction.length === 0 ||
        jurisdiction.length > MAX_JURISDICTION_LENGTH ||
        jurisdiction !== jurisdiction.trim()
      ) {
        errors.push(
          'JURISDICTION_MALFORMED',
          `${path}/jurisdiction`,
          'jurisdiction must be a non-empty trimmed string of at most 64 characters',
        );
        clean = false;
      }
      break;
    }
    case 'ALL_OF':
    case 'ANY_OF': {
      const conditions = node['conditions'];
      if (!Array.isArray(conditions)) {
        errors.push(
          'CONDITION_SHAPE_INVALID',
          `${path}/conditions`,
          'conditions must be an array',
        );
        clean = false;
      } else if (conditions.length === 0) {
        errors.push(
          'COMPOSITE_CHILDREN_EMPTY',
          `${path}/conditions`,
          `${op} must have at least one child condition`,
        );
        clean = false;
      } else {
        conditions.forEach((child, index) => {
          const childClean = validateCondition(
            child,
            `${path}/conditions/${index}`,
            depth + 1,
            visited,
            errors,
          );
          clean = clean && childClean;
        });
      }
      break;
    }
    case 'NOT': {
      const childClean = validateCondition(
        node['condition'],
        `${path}/condition`,
        depth + 1,
        visited,
        errors,
      );
      clean = clean && childClean;
      break;
    }
    case 'MANUAL_REVIEW': {
      if ('note' in node) {
        const note = node['note'];
        if (typeof note !== 'string' || note.trim().length === 0) {
          errors.push(
            'CONDITION_SHAPE_INVALID',
            `${path}/note`,
            'note, when present, must be a non-empty string',
          );
          clean = false;
        }
      }
      break;
    }
  }
  return clean;
}

// ---------------------------------------------------------------------------
// Contradiction analysis (structurally-clean conditions only)
// ---------------------------------------------------------------------------

/**
 * Canonical string form of a structurally valid condition, used only for
 * contradiction analysis inside this module. Commutative children (ALL_OF /
 * ANY_OF), VALUE_IN literals, and SOURCE_IN IDs are sorted. This is NOT the
 * project's canonical-representation boundary (that is `canonical.ts` in a
 * later wave) and is deliberately not exported.
 */
function canonicalKey(node: Record<string, unknown>): string {
  const op = node['operator'] as TrustSpecOperator;
  switch (op) {
    case 'ALL_OF':
    case 'ANY_OF': {
      const children = (node['conditions'] as Record<string, unknown>[])
        .map(canonicalKey)
        .sort();
      return `${op}(${children.join(',')})`;
    }
    case 'NOT':
      return `NOT(${canonicalKey(node['condition'] as Record<string, unknown>)})`;
    case 'VALUE_IN': {
      const allowed = [...(node['allowed'] as TrustSpecValueLiteral[])]
        .map((v) => JSON.stringify([typeof v, v]))
        .sort();
      return `VALUE_IN(${JSON.stringify(node['fieldPath'])},[${allowed.join(',')}])`;
    }
    case 'SOURCE_IN': {
      const ids = [...(node['sourceIds'] as string[])].sort();
      return `SOURCE_IN(${JSON.stringify(ids)})`;
    }
    default: {
      const keys = Object.keys(node)
        .filter((k) => k !== 'operator')
        .sort();
      return `${op}(${keys.map((k) => `${k}=${JSON.stringify(node[k])}`).join(',')})`;
    }
  }
}

function literalKey(value: TrustSpecValueLiteral): string {
  return JSON.stringify([typeof value, value]);
}

/**
 * Flattens the conjunctive context of a condition: the set of conditions that
 * must simultaneously hold. Nested ALL_OF children flatten through; ANY_OF and
 * NOT are boundaries (their children are not unconditionally required).
 */
function conjunctiveMembers(
  node: Record<string, unknown>,
): Record<string, unknown>[] {
  if (node['operator'] === 'ALL_OF') {
    return (node['conditions'] as Record<string, unknown>[]).flatMap(
      conjunctiveMembers,
    );
  }
  return [node];
}

/**
 * Detects direct contradictions inside every conjunctive context of a
 * structurally clean condition tree:
 *
 *  1. P together with NOT(P) (canonical structural equality);
 *  2. VALUE_EQUALS on the same fieldPath with different expected literals;
 *  3. VALUE_EQUALS whose expected literal is excluded by a sibling VALUE_IN
 *     on the same fieldPath.
 */
function detectContradictions(
  node: Record<string, unknown>,
  path: string,
  errors: ErrorCollector,
): void {
  const op = node['operator'] as TrustSpecOperator;

  if (op === 'ALL_OF') {
    const members = conjunctiveMembers(node);
    const positiveKeys = new Map<string, number>();
    const negatedKeys = new Map<string, number>();
    const equalsByField = new Map<string, Map<string, number>>();
    const inSetsByField = new Map<
      string,
      { memberIndex: number; literals: Set<string> }[]
    >();

    members.forEach((member, index) => {
      const memberOp = member['operator'] as TrustSpecOperator;
      if (memberOp === 'NOT') {
        const inner = member['condition'] as Record<string, unknown>;
        const key = canonicalKey(inner);
        if (!negatedKeys.has(key)) negatedKeys.set(key, index);
      } else {
        const key = canonicalKey(member);
        if (!positiveKeys.has(key)) positiveKeys.set(key, index);
      }
      if (memberOp === 'VALUE_EQUALS') {
        const field = member['fieldPath'] as string;
        const literal = literalKey(member['expected'] as TrustSpecValueLiteral);
        const byLiteral = equalsByField.get(field) ?? new Map<string, number>();
        if (!byLiteral.has(literal)) byLiteral.set(literal, index);
        equalsByField.set(field, byLiteral);
      }
      if (memberOp === 'VALUE_IN') {
        const field = member['fieldPath'] as string;
        const literals = new Set(
          (member['allowed'] as TrustSpecValueLiteral[]).map(literalKey),
        );
        const sets = inSetsByField.get(field) ?? [];
        sets.push({ memberIndex: index, literals });
        inSetsByField.set(field, sets);
      }
    });

    for (const [key, positiveIndex] of [...positiveKeys.entries()].sort()) {
      if (negatedKeys.has(key)) {
        errors.push(
          'CONDITION_CONTRADICTION',
          path,
          `condition ${key} is required both positively and under NOT in the same ALL_OF (members ${Math.min(positiveIndex, negatedKeys.get(key)!)} and ${Math.max(positiveIndex, negatedKeys.get(key)!)})`,
        );
      }
    }
    for (const [field, byLiteral] of [...equalsByField.entries()].sort()) {
      if (byLiteral.size > 1) {
        errors.push(
          'CONDITION_CONTRADICTION',
          path,
          `VALUE_EQUALS on field "${field}" requires ${byLiteral.size} different literals in the same ALL_OF`,
        );
      }
      const sets = inSetsByField.get(field) ?? [];
      for (const [literal] of [...byLiteral.entries()].sort()) {
        for (const set of sets) {
          if (!set.literals.has(literal)) {
            errors.push(
              'CONDITION_CONTRADICTION',
              path,
              `VALUE_EQUALS on field "${field}" requires a literal excluded by a sibling VALUE_IN in the same ALL_OF`,
            );
          }
        }
      }
    }
  }

  // Recurse into every composite child so nested conjunctions are analyzed too.
  if (op === 'ALL_OF' || op === 'ANY_OF') {
    (node['conditions'] as Record<string, unknown>[]).forEach((child, index) =>
      detectContradictions(child, `${path}/conditions/${index}`, errors),
    );
  } else if (op === 'NOT') {
    detectContradictions(
      node['condition'] as Record<string, unknown>,
      `${path}/condition`,
      errors,
    );
  }
}

// ---------------------------------------------------------------------------
// Dependency graph analysis
// ---------------------------------------------------------------------------

/**
 * Reports every distinct dependency cycle deterministically. Each cycle is
 * normalized to start at its lexicographically smallest member and reported
 * once, at that member's dependsOn path.
 */
function detectDependencyCycles(
  requirementIds: string[],
  edges: Map<string, string[]>,
  indexById: Map<string, number>,
  errors: ErrorCollector,
): void {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>(requirementIds.map((id) => [id, WHITE]));
  const reported = new Set<string>();

  const visit = (start: string): void => {
    const stack: { id: string; nextEdge: number }[] = [{ id: start, nextEdge: 0 }];
    color.set(start, GRAY);
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      const outgoing = edges.get(frame.id) ?? [];
      if (frame.nextEdge < outgoing.length) {
        const target = outgoing[frame.nextEdge]!;
        frame.nextEdge += 1;
        const targetColor = color.get(target);
        if (targetColor === WHITE) {
          color.set(target, GRAY);
          stack.push({ id: target, nextEdge: 0 });
        } else if (targetColor === GRAY) {
          const cycleStart = stack.findIndex((f) => f.id === target);
          const cycle = stack.slice(cycleStart).map((f) => f.id);
          const smallest = [...cycle].sort()[0]!;
          const rotation = cycle.indexOf(smallest);
          const normalized = [...cycle.slice(rotation), ...cycle.slice(0, rotation)];
          const cycleKey = normalized.join(' -> ');
          if (!reported.has(cycleKey)) {
            reported.add(cycleKey);
            errors.push(
              'DEPENDENCY_CYCLE',
              `/requirements/${indexById.get(smallest)}/dependsOn`,
              `dependency cycle: ${cycleKey} -> ${smallest}`,
            );
          }
        }
      } else {
        color.set(frame.id, BLACK);
        stack.pop();
      }
    }
  };

  for (const id of [...requirementIds].sort()) {
    if (color.get(id) === WHITE) visit(id);
  }
}

// ---------------------------------------------------------------------------
// Deterministic error ordering
// ---------------------------------------------------------------------------

function comparePaths(a: string, b: string): number {
  const aSegments = a.split('/');
  const bSegments = b.split('/');
  const length = Math.min(aSegments.length, bSegments.length);
  for (let i = 0; i < length; i += 1) {
    const aSeg = aSegments[i]!;
    const bSeg = bSegments[i]!;
    if (aSeg === bSeg) continue;
    const aNumeric = /^\d+$/.test(aSeg);
    const bNumeric = /^\d+$/.test(bSeg);
    if (aNumeric && bNumeric) return Number(aSeg) - Number(bSeg);
    return aSeg < bSeg ? -1 : 1;
  }
  return aSegments.length - bSegments.length;
}

function sortAndDedupe(
  errors: TrustSpecValidationError[],
): TrustSpecValidationError[] {
  const sorted = [...errors].sort((a, b) => {
    const byPath = comparePaths(a.path, b.path);
    if (byPath !== 0) return byPath;
    if (a.code !== b.code) return a.code < b.code ? -1 : 1;
    if (a.message !== b.message) return a.message < b.message ? -1 : 1;
    return 0;
  });
  const deduped: TrustSpecValidationError[] = [];
  for (const error of sorted) {
    const previous = deduped[deduped.length - 1];
    if (
      previous &&
      previous.code === error.code &&
      previous.path === error.path &&
      previous.message === error.message
    ) {
      continue;
    }
    deduped.push(error);
  }
  return deduped;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const SPEC_KEYS = [
  'schemaVersion',
  'specId',
  'specVersion',
  'organizationKey',
  'title',
  'requirements',
] as const;
const REQUIREMENT_KEYS = [
  'requirementId',
  'label',
  'necessity',
  'condition',
  'dependsOn',
] as const;

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

/**
 * Fail-closed structural validation of a candidate TrustSpec document.
 *
 * Accepts `unknown` because specs are machine-readable documents that will
 * eventually arrive as parsed JSON; nothing about the input is trusted. On
 * success, returns a deep-frozen typed copy of the spec (the input is never
 * mutated and never aliased). On failure, returns a deterministic,
 * (path, code, message)-ordered, deduplicated error list and `spec: null`.
 *
 * A valid spec is a policy definition and nothing more — see the module doc:
 * SATISFIED never means accepted.
 */
export function validateTrustSpec(candidate: unknown): TrustSpecValidationResult {
  const collected: TrustSpecValidationError[] = [];
  const errors: ErrorCollector = {
    push(code, path, message) {
      collected.push({ code, path, message });
    },
  };

  if (!isPlainObject(candidate)) {
    errors.push('SPEC_SHAPE_INVALID', '', 'TrustSpec must be a plain object');
    return { valid: false, spec: null, errors: sortAndDedupe(collected) };
  }

  for (const key of Object.keys(candidate).sort()) {
    if (!(SPEC_KEYS as readonly string[]).includes(key)) {
      errors.push(
        'SPEC_SHAPE_INVALID',
        `/${key}`,
        `unexpected key ${JSON.stringify(key)} on TrustSpec`,
      );
    }
  }

  if (candidate['schemaVersion'] !== TRUST_SPEC_SCHEMA_VERSION) {
    errors.push(
      'SCHEMA_VERSION_UNSUPPORTED',
      '/schemaVersion',
      `unsupported schemaVersion ${JSON.stringify(candidate['schemaVersion'])}; this validator accepts only ${JSON.stringify(TRUST_SPEC_SCHEMA_VERSION)} and fails closed on anything else`,
    );
  }
  if (!isWellFormedId(candidate['specId'])) {
    errors.push(
      'SPEC_ID_MALFORMED',
      '/specId',
      'specId must be 1-128 chars, alphanumeric plus [._:-], starting alphanumeric',
    );
  }
  const specVersion = candidate['specVersion'];
  if (
    typeof specVersion !== 'number' ||
    !Number.isInteger(specVersion) ||
    specVersion < 1
  ) {
    errors.push(
      'SPEC_VERSION_NOT_POSITIVE_INTEGER',
      '/specVersion',
      'specVersion must be a positive integer',
    );
  }
  if (!isWellFormedId(candidate['organizationKey'])) {
    errors.push(
      'ORGANIZATION_KEY_MALFORMED',
      '/organizationKey',
      'organizationKey must be 1-128 chars, alphanumeric plus [._:-], starting alphanumeric',
    );
  }
  const title = candidate['title'];
  if (typeof title !== 'string' || title.trim().length === 0) {
    errors.push('TITLE_EMPTY', '/title', 'title must be a non-empty string');
  }

  const requirements = candidate['requirements'];
  if (!Array.isArray(requirements)) {
    errors.push(
      'SPEC_SHAPE_INVALID',
      '/requirements',
      'requirements must be an array',
    );
    return { valid: false, spec: null, errors: sortAndDedupe(collected) };
  }
  if (requirements.length === 0) {
    errors.push(
      'REQUIREMENTS_EMPTY',
      '/requirements',
      'a TrustSpec must declare at least one requirement',
    );
  }

  const seenIds = new Map<string, number>();
  const indexById = new Map<string, number>();
  const dependencyEdges = new Map<string, string[]>();

  requirements.forEach((requirement, index) => {
    const requirementPath = `/requirements/${index}`;
    if (!isPlainObject(requirement)) {
      errors.push(
        'REQUIREMENT_SHAPE_INVALID',
        requirementPath,
        'requirement must be a plain object',
      );
      return;
    }
    for (const key of Object.keys(requirement).sort()) {
      if (!(REQUIREMENT_KEYS as readonly string[]).includes(key)) {
        errors.push(
          'REQUIREMENT_SHAPE_INVALID',
          `${requirementPath}/${key}`,
          `unexpected key ${JSON.stringify(key)} on requirement`,
        );
      }
    }

    const requirementId = requirement['requirementId'];
    let idIsUsable = false;
    if (!isWellFormedId(requirementId)) {
      errors.push(
        'REQUIREMENT_ID_MALFORMED',
        `${requirementPath}/requirementId`,
        'requirementId must be 1-128 chars, alphanumeric plus [._:-], starting alphanumeric',
      );
    } else if (seenIds.has(requirementId)) {
      errors.push(
        'REQUIREMENT_ID_DUPLICATE',
        `${requirementPath}/requirementId`,
        `requirementId ${JSON.stringify(requirementId)} duplicates /requirements/${seenIds.get(requirementId)}`,
      );
    } else {
      seenIds.set(requirementId, index);
      indexById.set(requirementId, index);
      idIsUsable = true;
    }

    const label = requirement['label'];
    if (typeof label !== 'string' || label.trim().length === 0) {
      errors.push(
        'REQUIREMENT_LABEL_EMPTY',
        `${requirementPath}/label`,
        'label must be a non-empty string',
      );
    }
    const necessity = requirement['necessity'];
    if (necessity !== 'mandatory' && necessity !== 'preferred') {
      errors.push(
        'NECESSITY_UNKNOWN',
        `${requirementPath}/necessity`,
        `necessity must be "mandatory" or "preferred", got ${JSON.stringify(necessity)}`,
      );
    }

    const dependsOn = requirement['dependsOn'];
    if (!Array.isArray(dependsOn)) {
      errors.push(
        'DEPENDENCY_MALFORMED',
        `${requirementPath}/dependsOn`,
        'dependsOn must be an array of requirement IDs (empty when independent)',
      );
    } else {
      const seenDependencies = new Set<string>();
      const usableEdges: string[] = [];
      dependsOn.forEach((dependency, dependencyIndex) => {
        const dependencyPath = `${requirementPath}/dependsOn/${dependencyIndex}`;
        if (!isWellFormedId(dependency)) {
          errors.push(
            'DEPENDENCY_MALFORMED',
            dependencyPath,
            'dependency must be a well-formed requirement ID',
          );
          return;
        }
        if (seenDependencies.has(dependency)) {
          errors.push(
            'DEPENDENCY_DUPLICATE',
            dependencyPath,
            `dependency ${JSON.stringify(dependency)} is listed more than once`,
          );
          return;
        }
        seenDependencies.add(dependency);
        if (dependency === requirementId) {
          errors.push(
            'DEPENDENCY_SELF',
            dependencyPath,
            'a requirement may not depend on itself',
          );
          return;
        }
        usableEdges.push(dependency);
      });
      if (idIsUsable) {
        dependencyEdges.set(requirementId as string, usableEdges);
      }
    }

    const conditionClean = validateCondition(
      requirement['condition'],
      `${requirementPath}/condition`,
      1,
      new Set<object>(),
      errors,
    );
    if (conditionClean) {
      detectContradictions(
        requirement['condition'] as Record<string, unknown>,
        `${requirementPath}/condition`,
        errors,
      );
    }
  });

  // Reference resolution: only IDs that parsed cleanly participate.
  const resolvableEdges = new Map<string, string[]>();
  for (const [fromId, targets] of dependencyEdges) {
    const fromIndex = indexById.get(fromId)!;
    const resolved: string[] = [];
    targets.forEach((target) => {
      if (!indexById.has(target)) {
        const dependencyIndex = (
          (requirements[fromIndex] as Record<string, unknown>)['dependsOn'] as unknown[]
        ).indexOf(target);
        errors.push(
          'DEPENDENCY_UNRESOLVED',
          `/requirements/${fromIndex}/dependsOn/${dependencyIndex}`,
          `dependency ${JSON.stringify(target)} does not name a requirement in this spec`,
        );
      } else {
        resolved.push(target);
      }
    });
    resolvableEdges.set(fromId, resolved);
  }
  detectDependencyCycles(
    [...indexById.keys()],
    resolvableEdges,
    indexById,
    errors,
  );

  const ordered = sortAndDedupe(collected);
  if (ordered.length > 0) {
    return { valid: false, spec: null, errors: ordered };
  }
  return {
    valid: true,
    spec: deepFreeze(structuredClone(candidate)) as unknown as TrustSpec,
    errors: [],
  };
}

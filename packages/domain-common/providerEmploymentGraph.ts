/**
 * Provider Employment Graph: Multi-Source Evidence Projection
 *
 * Pure functions for building the provider employment graph from raw
 * claims. No I/O, no database access, no randomness — every function
 * is deterministic and unit-testable in isolation.
 *
 * Core principles (from project spec):
 * - Conflicts NEVER disappear.
 * - Confidence reflects source strength.
 * - Agreement reflects signal consistency.
 * - No averaging; composition is deterministic.
 */

import type {
  EmploymentClaim,
  EmploymentClaimAgreement,
  EmploymentClaimConfidence,
  EmploymentGraph,
  EmploymentGraphNode,
} from './providerEmploymentContracts';

// ───────────────────────── employer grouping ─────────────────────────

function normalizeEmployerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalEmployerKey(claim: EmploymentClaim): string {
  if (claim.employerId !== undefined && claim.employerId.length > 0) {
    return `id:${claim.employerId}`;
  }
  return `name:${normalizeEmployerName(claim.employer)}`;
}

/**
 * Group claims by canonical employer key.
 *
 * Uses employerId when present (stable), else normalized employer name.
 * Name normalization: lowercase, strip punctuation, collapse whitespace.
 */
export function groupClaimsByEmployer(
  claims: readonly EmploymentClaim[],
): Map<string, EmploymentClaim[]> {
  const groups = new Map<string, EmploymentClaim[]>();
  for (const claim of claims) {
    const key = canonicalEmployerKey(claim);
    const existing = groups.get(key);
    if (existing !== undefined) {
      existing.push(claim);
    } else {
      groups.set(key, [claim]);
    }
  }
  return groups;
}

// ───────────────────────── conflict detection ─────────────────────────

function yearMonth(dateIso: string): string {
  return dateIso.slice(0, 7);
}

/**
 * Predicate: do these claims conflict with each other?
 *
 * Rules (deterministic, from project spec Q3):
 * - startDate: same year-month = agree; different = conflict
 * - endDate:
 *     • both null            → agree
 *     • both present, same YM → agree
 *     • null vs present      → conflict
 *     • both present, different YM → conflict
 * - role: undefined roles don't conflict with anything.
 *         two different present roles conflict.
 *
 * Single-claim (or empty) sets cannot conflict with themselves.
 */
export function hasConflict(claims: readonly EmploymentClaim[]): boolean {
  if (claims.length < 2) return false;

  const startMonths = new Set(claims.map((c) => yearMonth(c.startDate)));
  if (startMonths.size > 1) return true;

  const endSignals = new Set(
    claims.map((c) => (c.endDate === null ? 'active' : yearMonth(c.endDate))),
  );
  if (endSignals.size > 1) return true;

  const presentRoles = new Set(
    claims
      .map((c) => c.role)
      .filter((r): r is string => r !== undefined),
  );
  if (presentRoles.size > 1) return true;

  return false;
}

// ───────────────────────── confidence composition ─────────────────────────

/**
 * Deterministic confidence + agreement composition from the project spec.
 *
 * Rules (confirmed Q1/Q2/Q3):
 *   Q1: verified_source present, non-verified conflicts
 *       → confidence = high, agreement = conflict (flagged downstream)
 *   Q2: ≥2 verified_source rows disagree
 *       → confidence = medium, agreement = conflict
 *   Q3: year-month matching for date agreement
 *   Multiple distinct non-verified sources that agree
 *       → confidence = high, agreement = agree
 *   Single distinct source (1 source type), no internal conflict
 *       → confidence = medium (high if verified), agreement = single
 *   Non-verified sources only, conflicting
 *       → confidence = low, agreement = conflict
 *
 * Throws if given an empty claim set (programmer error — callers must
 * ensure at least one claim before composing).
 */
export function composeConfidence(claims: readonly EmploymentClaim[]): {
  confidence: EmploymentClaimConfidence;
  agreement: EmploymentClaimAgreement;
} {
  if (claims.length === 0) {
    throw new Error('composeConfidence requires at least one claim');
  }

  const distinctSources = new Set(claims.map((c) => c.source));
  const verifiedCount = claims.filter(
    (c) => c.source === 'verified_source',
  ).length;
  const conflict = hasConflict(claims);

  let agreement: EmploymentClaimAgreement;
  if (conflict) {
    agreement = 'conflict';
  } else if (distinctSources.size === 1) {
    agreement = 'single';
  } else {
    agreement = 'agree';
  }

  let confidence: EmploymentClaimConfidence;
  if (verifiedCount >= 2 && conflict) {
    // Q2: two authoritative sources disagreeing — refuse to claim high
    confidence = 'medium';
  } else if (verifiedCount >= 1) {
    // Q1: verified wins on confidence even when non-verified conflicts
    confidence = 'high';
  } else if (agreement === 'agree') {
    // Multiple distinct non-verified sources in agreement
    confidence = 'high';
  } else if (agreement === 'single') {
    // One source type, no conflict
    confidence = 'medium';
  } else {
    // No verified, with conflict
    confidence = 'low';
  }

  return { confidence, agreement };
}

// ───────────────────────── node building ─────────────────────────

function resolveStartDate(claims: readonly EmploymentClaim[]): string {
  return claims
    .map((c) => c.startDate)
    .reduce((earliest, d) => (d < earliest ? d : earliest));
}

function resolveEndDate(claims: readonly EmploymentClaim[]): string | null {
  const ends: string[] = [];
  for (const c of claims) {
    if (c.endDate === null) return null;
    ends.push(c.endDate);
  }
  return ends.reduce((latest, d) => (d > latest ? d : latest));
}

function pickModeRole(claims: readonly EmploymentClaim[]): string | undefined {
  const counts = new Map<string, number>();
  for (const c of claims) {
    if (c.role !== undefined) {
      counts.set(c.role, (counts.get(c.role) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return undefined;
  let maxCount = 0;
  let winner: string | undefined;
  for (const [role, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      winner = role;
    }
  }
  return winner;
}

function buildNode(claims: readonly EmploymentClaim[]): EmploymentGraphNode {
  const first = claims[0];
  const { confidence, agreement } = composeConfidence(claims);

  return {
    providerId: first.providerId,
    employer: first.employer,
    employerId: first.employerId,
    startDate: resolveStartDate(claims),
    endDate: resolveEndDate(claims),
    role: pickModeRole(claims),
    composedConfidence: confidence,
    agreement,
    claims,
    flagged: agreement === 'conflict',
  };
}

// ───────────────────────── graph assembly ─────────────────────────

/**
 * Build the employment graph for a provider from a raw claim list.
 *
 * Filters to this provider (defensive against mixed-provider inputs),
 * groups by canonical employer key, builds one node per group, and
 * sorts by startDate DESC.
 *
 * Active employers (endDate === null) are exposed as a separate field.
 * Multiple active employers are allowed (locum tenens reality).
 */
export function buildEmploymentGraph(
  providerId: string,
  claims: readonly EmploymentClaim[],
): EmploymentGraph {
  const own = claims.filter((c) => c.providerId === providerId);
  const groups = groupClaimsByEmployer(own);

  const nodes: EmploymentGraphNode[] = [];
  for (const [, groupClaims] of groups) {
    nodes.push(buildNode(groupClaims));
  }

  nodes.sort((a, b) => b.startDate.localeCompare(a.startDate));

  const currentEmployers = nodes.filter((n) => n.endDate === null);

  return { providerId, nodes, currentEmployers };
}

/**
 * Extract the set of currently-active employers from the graph.
 *
 * Multiple active employers are permitted (locum tenens). Sorted by
 * startDate DESC (inherited from the parent graph's node order).
 */
export function getCurrentEmployers(
  graph: EmploymentGraph,
): ReadonlyArray<EmploymentGraphNode> {
  return graph.currentEmployers;
}

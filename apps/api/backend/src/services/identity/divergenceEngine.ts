/**
 * divergenceEngine.ts — Cross-Source Divergence Detection
 *
 * VitalCV's anomaly layer: detects when the same clinical fact has
 * conflicting values across different authoritative sources.
 *
 * Cross-source conflicts are among the most valuable signals in provider
 * identity — they surface data quality problems that no single source
 * can reveal by itself.
 *
 * Architecture:
 * - Load newest artifacts per source for a given NPI
 * - Apply rule set: compare same-claim across sources
 * - Classify each conflict by severity (CRITICAL / MODERATE / MINOR)
 * - Calculate trust score penalty
 * - Integrate with Watchtower for monitoring alerts
 */

import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { appendAuditEvent } from '../audit/auditLedger';

export type ConflictSeverity = 'CRITICAL' | 'MODERATE' | 'MINOR';

export interface DivergenceConflict {
  id:          string;            // Deterministic: SHA-ish based on type+npi+sources
  claimType:   string;            // What claim type diverged
  dimension:   string;            // Which trust dimension this affects
  severity:    ConflictSeverity;
  description: string;            // Human-readable conflict description
  sources:     string[];          // Which sources conflict
  values:      string[];          // Conflicting values (redacted if sensitive)
  detectedAt:  string;
  penalty:     number;            // Score deduction
  requiresReview: boolean;
  resolution:  'OPEN' | 'RESOLVED' | 'ACKNOWLEDGED';
  resolutionNote?: string;
}

export interface DivergenceReport {
  npi:         string;
  computedAt:  string;
  conflicts:   DivergenceConflict[];
  totalPenalty: number;
  hasBlocking: boolean;           // Any CRITICAL conflicts
  summary:     string;
  rulesFired:  string[];          // Which rules detected conflicts
}

// ── Divergence rule set ────────────────────────────────────────────────────────
//
// Rules are defined as comparisons between artifacts from different sources
// that should agree on the same fact but don't.

type ArtifactPayload = {
  source:     string;
  status:     string;
  rawPayload: unknown;
  verifiedAt: Date;
};

interface DivergenceRule {
  id:          string;
  name:        string;
  description: string;
  dimension:   string;
  claimType:   string;
  severity:    ConflictSeverity;
  penalty:     number;
  detect:      (artifacts: ArtifactPayload[]) => DivergenceConflict | null;
}

function safePayload(artifact: ArtifactPayload): Record<string, unknown> {
  try {
    const p = artifact.rawPayload;
    if (typeof p === 'string') return JSON.parse(p) as Record<string, unknown>;
    if (typeof p === 'object' && p !== null) return p as Record<string, unknown>;
  } catch { /* ignore */ }
  return {};
}

function makeConflictId(type: string, npi: string, sources: string[]): string {
  const base = `${type}:${npi}:${sources.sort().join(',')}`;
  // Simple deterministic hash (not crypto — just dedup key)
  let hash = 0;
  for (const ch of base) { hash = (Math.imul(31, hash) + ch.charCodeAt(0)) | 0; }
  return `div_${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

const DIVERGENCE_RULES: DivergenceRule[] = [
  // ── R1: Exclusion mismatch ───────────────────────────────────────────────
  {
    id: 'R1', name: 'EXCLUSION_MISMATCH',
    description: 'OIG and SAM.gov disagree on exclusion status',
    dimension: 'exclusion', claimType: 'EXCLUSION_STATUS',
    severity: 'CRITICAL', penalty: 15,
    detect(arts) {
      const oig = arts.find(a => a.source === 'OIG_LEIE');
      const sam = arts.find(a => a.source === 'SAM_GOV');
      if (!oig || !sam) return null;
      const oigExcluded = oig.status === 'EXCLUDED';
      const samExcluded = sam.status === 'EXCLUDED';
      if (oigExcluded === samExcluded) return null;
      return {
        id: makeConflictId('R1', 'npi', ['OIG_LEIE', 'SAM_GOV']),
        claimType: 'EXCLUSION_STATUS', dimension: 'exclusion',
        severity: 'CRITICAL',
        description: `OIG/LEIE says ${oigExcluded ? 'EXCLUDED' : 'CLEAR'} but SAM.gov says ${samExcluded ? 'EXCLUDED' : 'CLEAR'}.`,
        sources: ['OIG_LEIE', 'SAM_GOV'],
        values: [oig.status, sam.status],
        detectedAt: new Date().toISOString(),
        penalty: 15, requiresReview: true, resolution: 'OPEN',
      };
    },
  },

  // ── R2: License status contradiction between sources ─────────────────────
  {
    id: 'R2', name: 'LICENSURE_STATUS_MISMATCH',
    description: 'License status differs between PECOS and state board',
    dimension: 'licensure', claimType: 'LICENSURE_STATUS',
    severity: 'CRITICAL', penalty: 12,
    detect(arts) {
      const pecos = arts.find(a => a.source === 'PECOS_PUBLIC');
      const board = arts.find(a => a.source === 'STATE_BOARD' || a.source === 'NURSYS');
      if (!pecos || !board) return null;
      const pecosActive = pecos.status === 'ENROLLED' || pecos.status === 'ACTIVE' || pecos.status === 'VERIFIED';
      const boardRevoked = board.status === 'REVOKED' || board.status === 'SUSPENDED' || board.status === 'EXPIRED';
      if (!(pecosActive && boardRevoked)) return null;
      return {
        id: makeConflictId('R2', 'npi', [pecos.source, board.source]),
        claimType: 'LICENSURE_STATUS', dimension: 'licensure',
        severity: 'CRITICAL',
        description: `PECOS shows active enrollment but ${board.source} shows ${board.status} license — potential stale data or board action.`,
        sources: [pecos.source, board.source],
        values: [pecos.status, board.status],
        detectedAt: new Date().toISOString(),
        penalty: 12, requiresReview: true, resolution: 'OPEN',
      };
    },
  },

  // ── R3: Stale vs fresh exclusion contradiction ────────────────────────────
  {
    id: 'R3', name: 'STALE_FRESH_EXCLUSION_CONTRADICTION',
    description: 'Old OIG check was CLEAR but new check could not be confirmed',
    dimension: 'exclusion', claimType: 'EXCLUSION_STATUS',
    severity: 'MODERATE', penalty: 7,
    detect(arts) {
      const oigArts = arts.filter(a => a.source === 'OIG_LEIE')
        .sort((a, b) => b.verifiedAt.getTime() - a.verifiedAt.getTime());
      if (oigArts.length < 2) return null;
      const newest = oigArts[0]!;
      const older  = oigArts[1]!;
      const newerUnknown = newest.status === 'UNKNOWN' || newest.status === 'ERROR';
      const olderClear   = older.status === 'VERIFIED' || older.status === 'CLEAR';
      if (!(newerUnknown && olderClear)) return null;
      return {
        id: makeConflictId('R3', 'npi', ['OIG_LEIE', 'OIG_LEIE_OLD']),
        claimType: 'EXCLUSION_STATUS', dimension: 'exclusion',
        severity: 'MODERATE',
        description: `Previous OIG check was CLEAR but most recent check returned UNKNOWN — cannot confirm clean status.`,
        sources: ['OIG_LEIE'],
        values: ['CLEAR (historical)', newest.status],
        detectedAt: new Date().toISOString(),
        penalty: 7, requiresReview: true, resolution: 'OPEN',
      };
    },
  },

  // ── R4: Enrollment vs affiliation mismatch ────────────────────────────────
  {
    id: 'R4', name: 'ENROLLMENT_AFFILIATION_MISMATCH',
    description: 'CMS enrollment data conflicts with affiliation claims',
    dimension: 'enrollment', claimType: 'ENROLLMENT_STATUS',
    severity: 'MODERATE', penalty: 5,
    detect(arts) {
      const pecos = arts.find(a => a.source === 'PECOS_PUBLIC');
      const dc    = arts.find(a => a.source === 'DOCTORS_CLINICIANS');
      if (!pecos || !dc) return null;
      const pecosEnrolled = pecos.status === 'ENROLLED';
      const dcNotListed   = dc.status === 'NOT_FOUND' || dc.status === 'INACTIVE';
      if (!(pecosEnrolled && dcNotListed)) return null;
      return {
        id: makeConflictId('R4', 'npi', ['PECOS_PUBLIC', 'DOCTORS_CLINICIANS']),
        claimType: 'ENROLLMENT_STATUS', dimension: 'enrollment',
        severity: 'MODERATE',
        description: 'PECOS shows Medicare enrollment but provider not found in D&C listing — may indicate incomplete CMS propagation.',
        sources: ['PECOS_PUBLIC', 'DOCTORS_CLINICIANS'],
        values: ['ENROLLED', 'NOT_LISTED'],
        detectedAt: new Date().toISOString(),
        penalty: 5, requiresReview: false, resolution: 'OPEN',
      };
    },
  },

  // ── R5: Open Payments vs NPPES practice location mismatch ────────────────
  {
    id: 'R5', name: 'PRACTICE_LOCATION_MISMATCH',
    description: 'Open Payments organization differs from NPPES practice location',
    dimension: 'identity', claimType: 'PRACTICE_LOCATION',
    severity: 'MINOR', penalty: 3,
    detect(arts) {
      const nppes = arts.find(a => a.source === 'NPPES_API' || a.source === 'NPPES_BULK');
      const op    = arts.find(a => a.source === 'OPEN_PAYMENTS');
      if (!nppes || !op) return null;
      const nppesPayload  = safePayload(nppes);
      const opPayload     = safePayload(op);
      const nppesCityRaw  = nppesPayload['practiceCity'] ?? nppesPayload['city'];
      const opCityRaw     = opPayload['recipientCity'] ?? opPayload['city'];
      const nppesCity = typeof nppesCityRaw === 'string' ? nppesCityRaw.toUpperCase().trim() : null;
      const opCity    = typeof opCityRaw === 'string' ? opCityRaw.toUpperCase().trim() : null;
      if (!nppesCity || !opCity || nppesCity === opCity) return null;
      // Cities differ
      return {
        id: makeConflictId('R5', 'npi', ['NPPES_API', 'OPEN_PAYMENTS']),
        claimType: 'PRACTICE_LOCATION', dimension: 'identity',
        severity: 'MINOR',
        description: `NPPES practice city (${nppesCity}) differs from Open Payments city (${opCity}) — may indicate recent move or dual practice.`,
        sources: ['NPPES_API', 'OPEN_PAYMENTS'],
        values: [nppesCity, opCity],
        detectedAt: new Date().toISOString(),
        penalty: 3, requiresReview: false, resolution: 'OPEN',
      };
    },
  },

  // ── R6: Identity name mismatch across sources ─────────────────────────────
  {
    id: 'R6', name: 'IDENTITY_NAME_MISMATCH',
    description: 'Provider name differs significantly across authoritative sources',
    dimension: 'identity', claimType: 'PERSONAL_IDENTITY',
    severity: 'MODERATE', penalty: 6,
    detect(arts) {
      const nppes = arts.find(a => a.source === 'NPPES_API');
      const pecos = arts.find(a => a.source === 'PECOS_PUBLIC');
      if (!nppes || !pecos) return null;
      const nppesPayload = safePayload(nppes);
      const pecosPayload = safePayload(pecos);
      const nppesLastRaw = nppesPayload['lastName'] ?? nppesPayload['last_name'];
      const pecosLastRaw = pecosPayload['lastName'] ?? pecosPayload['last_name'];
      const nppesLast = typeof nppesLastRaw === 'string' ? nppesLastRaw.toUpperCase().trim() : null;
      const pecosLast = typeof pecosLastRaw === 'string' ? pecosLastRaw.toUpperCase().trim() : null;
      if (!nppesLast || !pecosLast) return null;
      if (nppesLast === pecosLast) return null;
      // Check if one is a substring (maiden name, hyphenation)
      if (nppesLast.includes(pecosLast) || pecosLast.includes(nppesLast)) return null;
      return {
        id: makeConflictId('R6', 'npi', ['NPPES_API', 'PECOS_PUBLIC']),
        claimType: 'PERSONAL_IDENTITY', dimension: 'identity',
        severity: 'MODERATE',
        description: `Last name mismatch: NPPES shows "${nppesLast}" vs PECOS "${pecosLast}" — possible name change or data entry error.`,
        sources: ['NPPES_API', 'PECOS_PUBLIC'],
        values: [nppesLast, pecosLast],
        detectedAt: new Date().toISOString(),
        penalty: 6, requiresReview: true, resolution: 'OPEN',
      };
    },
  },

  // ── R7: Specialty mismatch across sources ─────────────────────────────────
  {
    id: 'R7', name: 'SPECIALTY_MISMATCH',
    description: 'Primary specialty differs between NPPES and clinical records',
    dimension: 'identity', claimType: 'SPECIALTY',
    severity: 'MINOR', penalty: 2,
    detect(arts) {
      const nppes = arts.find(a => a.source === 'NPPES_API');
      const op    = arts.find(a => a.source === 'OPEN_PAYMENTS');
      if (!nppes || !op) return null;
      const nppesPayload  = safePayload(nppes);
      const opPayload     = safePayload(op);
      const nppesSpecRaw  = nppesPayload['taxonomy'] ?? nppesPayload['primarySpecialty'];
      const opSpecRaw     = opPayload['specialty'] ?? opPayload['coveredRecipientSpecialty1'];
      const nppesSpec = typeof nppesSpecRaw === 'string' ? nppesSpecRaw.toUpperCase().slice(0, 20) : null;
      const opSpec    = typeof opSpecRaw === 'string' ? opSpecRaw.toUpperCase().slice(0, 20) : null;
      if (!nppesSpec || !opSpec) return null;
      // Rough similarity check — if first 8 chars match, probably same specialty
      if (nppesSpec.slice(0, 8) === opSpec.slice(0, 8)) return null;
      return {
        id: makeConflictId('R7', 'npi', ['NPPES_API', 'OPEN_PAYMENTS']),
        claimType: 'SPECIALTY', dimension: 'identity',
        severity: 'MINOR',
        description: `Specialty differs: NPPES "${nppesSpec.slice(0, 30)}" vs Open Payments "${opSpec.slice(0, 30)}".`,
        sources: ['NPPES_API', 'OPEN_PAYMENTS'],
        values: [nppesSpec, opSpec],
        detectedAt: new Date().toISOString(),
        penalty: 2, requiresReview: false, resolution: 'OPEN',
      };
    },
  },
];

// ── Main divergence detection function ────────────────────────────────────────

export async function detectDivergence(npi: string): Promise<DivergenceReport> {
  // Load newest artifact per source
  const rawArts = await prisma.verificationArtifact.findMany({
    where: { npi, status: { not: 'REVOKED' } },
    orderBy: { verifiedAt: 'desc' },
    select: { source: true, status: true, rawPayload: true, verifiedAt: true },
  });

  // Deduplicate: keep newest per source (all records for multi-check rules)
  const artifacts: ArtifactPayload[] = rawArts.map(a => ({
    source:     a.source,
    status:     a.status,
    rawPayload: a.rawPayload,
    verifiedAt: a.verifiedAt,
  }));

  const conflicts: DivergenceConflict[] = [];
  const rulesFired: string[] = [];

  for (const rule of DIVERGENCE_RULES) {
    try {
      const conflict = rule.detect(artifacts);
      if (conflict) {
        // Patch ID with actual NPI
        conflict.id = makeConflictId(rule.id, npi, conflict.sources);
        conflicts.push(conflict);
        rulesFired.push(rule.id);
      }
    } catch (err) {
      log('warn', `[DivergenceEngine] Rule ${rule.id} failed for NPI ${npi}: ${(err as Error)?.message}`);
    }
  }

  const totalPenalty = conflicts.reduce((sum, c) => sum + c.penalty, 0);
  const hasBlocking  = conflicts.some(c => c.severity === 'CRITICAL');

  // Emit audit event for critical conflicts
  if (hasBlocking) {
    for (const conflict of conflicts.filter(c => c.severity === 'CRITICAL')) {
      try {
        appendAuditEvent({
          category: 'VERIFICATION',
          actor:    'divergence-engine',
          resource: `npi:${npi}`,
          severity: 'CRITICAL',
          resultFields: {
            conflictId:  conflict.id,
            claimType:   conflict.claimType,
            description: conflict.description,
            sources:     conflict.sources,
            penalty:     conflict.penalty,
          },
        });
      } catch { /* audit failure is non-blocking */ }
    }
  }

  const critCount  = conflicts.filter(c => c.severity === 'CRITICAL').length;
  const modCount   = conflicts.filter(c => c.severity === 'MODERATE').length;
  const minorCount = conflicts.filter(c => c.severity === 'MINOR').length;

  const summary = conflicts.length === 0
    ? 'No cross-source conflicts detected.'
    : `${conflicts.length} conflict(s) detected: ${critCount} critical, ${modCount} moderate, ${minorCount} minor. Total penalty: -${totalPenalty} pts.`;

  log('info', `[DivergenceEngine] NPI ${npi}: ${summary}`);

  return {
    npi, computedAt: new Date().toISOString(),
    conflicts, totalPenalty, hasBlocking, summary, rulesFired,
  };
}

// ── Batch divergence scan ──────────────────────────────────────────────────────

export async function batchDivergenceScan(
  npis: string[],
): Promise<Array<{ npi: string; conflicts: number; hasBlocking: boolean }>> {
  const results = await Promise.allSettled(npis.map(npi => detectDivergence(npi)));
  return results.map((r, i) => {
    if (r.status === 'fulfilled') {
      return {
        npi:         r.value.npi,
        conflicts:   r.value.conflicts.length,
        hasBlocking: r.value.hasBlocking,
      };
    }
    return { npi: npis[i]!, conflicts: -1, hasBlocking: false };
  });
}

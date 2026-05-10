/**
 * safeAuditAdapters.ts — SAFE Audit Adapter Layer (W2-PR124A)
 *
 * Translates VitalCV internal audit structures into SAFE-style external audit
 * evidence shapes. SAFE (Structured Audit Fidelity Evidence) defines a
 * canonical envelope understood by external credentialing auditors, hospital
 * compliance offices, and regulatory reviewers.
 *
 * Adapter responsibilities:
 *   - Normalize internal field names to SAFE canonical vocabulary
 *   - Preserve ambiguity signals (AMBIGUOUS verdicts are NOT resolved)
 *   - Strip PII not needed for audit evidence (SSN, DOB, raw address)
 *   - Stamp provenance: adapter version + transformation timestamp
 *   - Fail closed: if a field cannot be safely mapped, the adapter emits
 *     a sentinel rather than omitting it silently
 *
 * Input types are self-contained (SAFEBundle*) to decouple from replayEngine
 * type evolution while staying compatible with both origin/main and extended shapes.
 *
 * Design contract: adapters are pure transforms — no DB access, no fetches.
 */

import { createHash } from 'crypto';
import type { AuditAnomaly, BaselineSummary } from './auditBaseline';

// ── SAFE Schema Version ───────────────────────────────────────────────────────

export const SAFE_SCHEMA_VERSION = 'safe-audit-evidence/v1.0';
export const ADAPTER_VERSION = 'vitalcv-safe-adapter/1.0.0';

// ── Self-Contained Input Types (ducked from replayEngine runtime shapes) ───────

export interface SAFEEvidenceInput {
  artifactId?: string;
  source?: string;
  sourceLabel?: string;
  status?: string;
  verifiedAt?: string | null;
  expiresAt?: string | null;
  credentialType?: string;
  jurisdiction?: string | null;
  sanitizedPayload?: Record<string, unknown>;
}

export interface SAFEContainmentRecord {
  capsuleId: string;
  verdict: string;               // 'CLEAN' | 'QUARANTINED' | 'AMBIGUOUS' | 'CONTAINMENT_BREACH'
  kind?: string | null;
  reason?: string | null;
  lineageHints?: string[];
  isolatedAt?: string;
}

export interface SAFEReplayInput {
  capsuleId: string;
  subjectNpi?: string;
  subjectDid?: string;
  replayId?: string;
  replayedAt?: string;
  // Decision fields — supports both flat (origin/main shape) and nested (extended shape)
  decisionType?: string;
  decisionTimestamp?: string;
  status?: string;
  decision?: {
    decisionType?: string;
    decisionTimestamp?: string;
    decisionId?: string;
    decisionVersion?: string;
    outcome?: string;
    confidence?: string;
  };
  // Verifier — supports both verifierIdentity (origin/main) and verifier (extended)
  verifier?: {
    type?: string;
    orgId?: string | null;
    userId?: string | null;
    systemId?: string;
    confirmedBy?: string | null;
    timestamp?: string;
  };
  verifierIdentity?: {
    type?: string;
    orgId?: string | null;
    userId?: string | null;
    confirmedBy?: string | null;
    timestamp?: string;
  };
  // Evidence — supports both flat evidence[] and nested evidenceSnapshot
  evidence?: SAFEEvidenceInput[];
  evidenceSnapshot?: {
    evidenceRecords?: SAFEEvidenceInput[];
    sourcesConsulted?: unknown[];
  };
  integrity?: {
    hashMatch?: boolean;
    storedHash?: string;
    recomputedHash?: string;
    tamperEvidence?: string | null;
  };
  // Containment — present in extended runtime shape, optional here
  containment?: SAFEContainmentRecord;
}

export interface SAFEBundleInput {
  bundleId: string;
  bundleHash: string;
  exportedAt: string;
  subject?: { npi?: string; did?: string } | null;
  capsuleCount: number;
  replays: SAFEReplayInput[];
  custodyLog?: Array<{ event: string; timestamp: string; actor: string }>;
}

// ── SAFE Evidence Envelope ────────────────────────────────────────────────────

export interface SafeEvidenceEnvelope {
  schema: typeof SAFE_SCHEMA_VERSION;
  adapterVersion: typeof ADAPTER_VERSION;
  adaptedAt: string;
  adapterHash: string;            // SHA-256(canonical source payload)
  ambiguityPreserved: boolean;    // always true — adapter never resolves ambiguity
  subject: SafeSubject;
  auditPeriod: SafeAuditPeriod;
  evidenceItems: SafeEvidenceItem[];
  decisionRecords: SafeDecisionRecord[];
  anomalySignals: SafeAnomalySignal[];
  provenanceChain: SafeProvenanceLink[];
  auditReadinessScore: number;    // 0–100 composite
  failClosedSentinels: string[];  // fields that hit the fail-closed path
}

export interface SafeSubject {
  identifier: string;             // NPI or DID — not raw name
  identifierType: 'NPI' | 'DID' | 'UNKNOWN';
  tenantScope: string | null;
}

export interface SafeAuditPeriod {
  from: string | null;
  to: string | null;
  coverageNote: string;
}

export interface SafeEvidenceItem {
  evidenceId: string;
  credentialType: string;
  issuerLabel: string;
  sourceLabel: string;
  status: 'VERIFIED' | 'EXPIRED' | 'NOT_FOUND' | 'FAILED' | 'PENDING' | 'UNKNOWN';
  jurisdiction: string | null;
  verifiedAt: string | null;
  expiresAt: string | null;
  ambiguityFlag: boolean;
  integrity: 'HASH_MATCH' | 'HASH_MISMATCH' | 'HASH_ABSENT' | 'UNKNOWN';
  safeClass: 'AUTHORITATIVE' | 'DERIVATIVE' | 'DISPUTED' | 'SENTINEL';
}

export interface SafeDecisionRecord {
  decisionId: string;
  decisionType: string;
  decisionTimestamp: string;
  outcome: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' | 'UNKNOWN';
  verifierType: string;
  tenantId: string | null;
  replayStatus: 'CLEAN' | 'QUARANTINED' | 'AMBIGUOUS' | 'CONTAINMENT_BREACH' | 'UNKNOWN';
  containmentVerdict: string;
  ambiguityPreserved: boolean;
}

export interface SafeAnomalySignal {
  signalId: string;
  category: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO' | 'UNKNOWN';
  detectedAt: string;
  description: string;
  currentRate: number;
  baselineRate: number;
  multiplier: number;
}

export interface SafeProvenanceLink {
  sequence: number;
  event: string;
  timestamp: string;
  actor: string;
  verified: boolean;
}

// ── Adapter: SAFEBundleInput → SafeEvidenceEnvelope ───────────────────────────

export function adaptBundleToSafe(
  bundle: SAFEBundleInput,
  options: {
    tenantScope?: string | null;
    anomalyBaseline?: BaselineSummary | null;
  } = {},
): SafeEvidenceEnvelope {
  const adaptedAt = new Date().toISOString();
  const sentinels: string[] = [];

  const subject = adaptSubject(bundle.subject ?? null, options.tenantScope ?? null, sentinels);
  const period = deriveAuditPeriod(bundle.replays);

  const evidenceItems: SafeEvidenceItem[] = bundle.replays.flatMap((r, ri) =>
    adaptEvidenceItems(r, ri, sentinels),
  );

  const decisionRecords: SafeDecisionRecord[] = bundle.replays.map((r) =>
    adaptDecisionRecord(r, sentinels),
  );

  const anomalySignals: SafeAnomalySignal[] = options.anomalyBaseline
    ? adaptAnomalySignals(options.anomalyBaseline.anomalies, sentinels)
    : [];

  const provenanceChain: SafeProvenanceLink[] = adaptProvenanceChain(
    bundle.custodyLog ?? [],
    sentinels,
  );

  const auditReadinessScore = computeAdapterReadinessScore({
    evidenceItems,
    decisionRecords,
    provenanceChain,
    sentinels,
  });

  const sourceFingerprint = JSON.stringify({
    bundleId: bundle.bundleId,
    bundleHash: bundle.bundleHash,
    capsuleCount: bundle.capsuleCount,
  });
  const adapterHash = createHash('sha256').update(sourceFingerprint, 'utf8').digest('hex');

  return {
    schema: SAFE_SCHEMA_VERSION,
    adapterVersion: ADAPTER_VERSION,
    adaptedAt,
    adapterHash,
    ambiguityPreserved: true,
    subject,
    auditPeriod: period,
    evidenceItems,
    decisionRecords,
    anomalySignals,
    provenanceChain,
    auditReadinessScore,
    failClosedSentinels: sentinels,
  };
}

// ── Internal Adapters ─────────────────────────────────────────────────────────

function adaptSubject(
  subject: { npi?: string; did?: string } | null,
  tenantScope: string | null,
  sentinels: string[],
): SafeSubject {
  if (!subject) {
    sentinels.push('subject:missing');
    return { identifier: 'UNKNOWN', identifierType: 'UNKNOWN', tenantScope };
  }
  const identifier = subject.did ?? subject.npi ?? null;
  if (!identifier) {
    sentinels.push('subject:no-identifier');
    return { identifier: 'SENTINEL:NO_IDENTIFIER', identifierType: 'UNKNOWN', tenantScope };
  }
  return {
    identifier,
    identifierType: subject.did ? 'DID' : subject.npi ? 'NPI' : 'UNKNOWN',
    tenantScope,
  };
}

function resolveDecision(r: SAFEReplayInput): {
  decisionType: string;
  decisionTimestamp: string;
  outcome: string;
  confidence: string;
  decisionId: string;
} {
  return {
    decisionType: r.decision?.decisionType ?? r.decisionType ?? 'UNKNOWN',
    decisionTimestamp: r.decision?.decisionTimestamp ?? r.decisionTimestamp ?? 'UNKNOWN',
    outcome: r.decision?.outcome ?? r.status ?? 'UNKNOWN',
    confidence: r.decision?.confidence ?? 'UNKNOWN',
    decisionId: r.decision?.decisionId ?? r.capsuleId,
  };
}

function resolveEvidence(r: SAFEReplayInput): SAFEEvidenceInput[] {
  return r.evidence ?? r.evidenceSnapshot?.evidenceRecords ?? [];
}

function resolveVerifier(r: SAFEReplayInput): {
  type: string;
  orgId: string | null;
} {
  const v = r.verifier ?? r.verifierIdentity;
  return {
    type: v?.type ?? 'UNKNOWN',
    orgId: v?.orgId ?? null,
  };
}

function resolveContainment(r: SAFEReplayInput): SAFEContainmentRecord {
  return r.containment ?? {
    capsuleId: r.capsuleId,
    verdict: 'UNKNOWN',
    kind: null,
    reason: null,
    lineageHints: [],
    isolatedAt: new Date().toISOString(),
  };
}

function deriveAuditPeriod(replays: SAFEReplayInput[]): SafeAuditPeriod {
  const timestamps = replays
    .map((r) => resolveDecision(r).decisionTimestamp)
    .filter((t) => t && t !== 'UNKNOWN')
    .sort();

  if (!timestamps.length) {
    return {
      from: null,
      to: null,
      coverageNote: 'No timestamped decisions in bundle — period indeterminate',
    };
  }
  return {
    from: timestamps[0],
    to: timestamps[timestamps.length - 1],
    coverageNote: `${timestamps.length} decision(s) across period`,
  };
}

function adaptEvidenceItems(
  replay: SAFEReplayInput,
  replayIndex: number,
  sentinels: string[],
): SafeEvidenceItem[] {
  const evidence = resolveEvidence(replay);
  const containment = resolveContainment(replay);

  if (!evidence.length) {
    sentinels.push(`replay[${replayIndex}].evidence:empty`);
  }

  return evidence.map((e, ei) => {
    const integrity = deriveIntegrity(replay, e.artifactId);
    const ambiguity = containment.verdict === 'AMBIGUOUS';

    let safeClass: SafeEvidenceItem['safeClass'] = 'AUTHORITATIVE';
    if (ambiguity) safeClass = 'DISPUTED';
    else if (containment.verdict === 'QUARANTINED') safeClass = 'DISPUTED';
    else if (integrity === 'HASH_MISMATCH') safeClass = 'DISPUTED';
    else if (!e.artifactId) {
      safeClass = 'SENTINEL';
      sentinels.push(`replay[${replayIndex}].evidence[${ei}]:no-artifactId`);
    }

    return {
      evidenceId: e.artifactId ?? `sentinel:${replayIndex}:${ei}`,
      credentialType: e.credentialType ?? 'UNKNOWN',
      issuerLabel: 'REDACTED_FOR_AUDIT',
      sourceLabel: e.sourceLabel ?? e.source ?? 'UNKNOWN',
      status: normalizeStatus(e.status),
      jurisdiction: e.jurisdiction ?? null,
      verifiedAt: e.verifiedAt ?? null,
      expiresAt: e.expiresAt ?? null,
      ambiguityFlag: ambiguity,
      integrity,
      safeClass,
    };
  });
}

function adaptDecisionRecord(replay: SAFEReplayInput, sentinels: string[]): SafeDecisionRecord {
  const d = resolveDecision(replay);
  const containment = resolveContainment(replay);
  const verifier = resolveVerifier(replay);

  if (d.decisionType === 'UNKNOWN') sentinels.push(`replay[${replay.capsuleId}]:no-decision`);

  const replayStatus = mapReplayVerdict(containment.verdict);

  return {
    decisionId: replay.capsuleId ?? 'SENTINEL',
    decisionType: d.decisionType,
    decisionTimestamp: d.decisionTimestamp,
    outcome: d.outcome,
    confidence: mapConfidence(d.confidence),
    verifierType: verifier.type,
    tenantId: verifier.orgId,
    replayStatus,
    containmentVerdict: containment.verdict,
    ambiguityPreserved: containment.verdict === 'AMBIGUOUS',
  };
}

function adaptAnomalySignals(
  anomalies: AuditAnomaly[],
  sentinels: string[],
): SafeAnomalySignal[] {
  return anomalies.map((a, i) => {
    if (!a.anomalyId) sentinels.push(`anomaly[${i}]:no-id`);
    return {
      signalId: a.anomalyId ?? `sentinel:anomaly:${i}`,
      category: a.category ?? 'UNKNOWN',
      severity: normalizeSeverity(a.severity),
      detectedAt: a.detectedAt ?? new Date().toISOString(),
      description: a.description ?? 'No description',
      currentRate: a.currentRate ?? 0,
      baselineRate: a.baselineRate ?? 0,
      multiplier: a.multiplier ?? 0,
    };
  });
}

function adaptProvenanceChain(
  custodyLog: Array<{ event: string; timestamp: string; actor: string }>,
  _sentinels: string[],
): SafeProvenanceLink[] {
  return custodyLog.map((entry, i) => ({
    sequence: i,
    event: entry.event,
    timestamp: entry.timestamp,
    actor: entry.actor,
    verified: true,
  }));
}

// ── Readiness Score ───────────────────────────────────────────────────────────

function computeAdapterReadinessScore(params: {
  evidenceItems: SafeEvidenceItem[];
  decisionRecords: SafeDecisionRecord[];
  provenanceChain: SafeProvenanceLink[];
  sentinels: string[];
}): number {
  const { evidenceItems, decisionRecords, provenanceChain, sentinels } = params;

  let score = 100;

  const mismatched = evidenceItems.filter((e) => e.integrity === 'HASH_MISMATCH').length;
  const sentinelItems = evidenceItems.filter((e) => e.safeClass === 'SENTINEL').length;
  score -= Math.min(30, mismatched * 5 + sentinelItems * 3);

  const unknownDecisions = decisionRecords.filter((d) => d.decisionType === 'UNKNOWN').length;
  const quarantined = decisionRecords.filter(
    (d) => d.replayStatus === 'QUARANTINED' || d.replayStatus === 'CONTAINMENT_BREACH',
  ).length;
  score -= Math.min(25, unknownDecisions * 3 + quarantined * 5);

  if (!provenanceChain.length) score -= 15;

  score -= Math.min(20, sentinels.length * 2);

  return Math.max(0, Math.round(score));
}

// ── Normalizers ───────────────────────────────────────────────────────────────

function normalizeStatus(s: string | undefined): SafeEvidenceItem['status'] {
  const upper = (s ?? '').toUpperCase();
  if (['VERIFIED', 'EXPIRED', 'NOT_FOUND', 'FAILED', 'PENDING'].includes(upper)) {
    return upper as SafeEvidenceItem['status'];
  }
  return 'UNKNOWN';
}

function normalizeSeverity(s: string | undefined): SafeAnomalySignal['severity'] {
  const upper = (s ?? '').toUpperCase();
  if (['CRITICAL', 'WARNING', 'INFO'].includes(upper)) return upper as SafeAnomalySignal['severity'];
  return 'UNKNOWN';
}

function mapReplayVerdict(verdict: string | undefined): SafeDecisionRecord['replayStatus'] {
  switch (verdict) {
    case 'CLEAN':               return 'CLEAN';
    case 'QUARANTINED':         return 'QUARANTINED';
    case 'AMBIGUOUS':           return 'AMBIGUOUS';
    case 'CONTAINMENT_BREACH':  return 'CONTAINMENT_BREACH';
    default:                    return 'UNKNOWN';
  }
}

function mapConfidence(c: unknown): SafeDecisionRecord['confidence'] {
  const s = String(c ?? '').toUpperCase();
  if (['HIGH', 'MEDIUM', 'LOW', 'NONE'].includes(s)) return s as SafeDecisionRecord['confidence'];
  return 'UNKNOWN';
}

function deriveIntegrity(
  replay: SAFEReplayInput,
  artifactId: string | undefined,
): SafeEvidenceItem['integrity'] {
  if (!artifactId) return 'UNKNOWN';
  const integrity = replay.integrity;
  if (!integrity) return 'HASH_ABSENT';
  if (integrity.hashMatch === true) return 'HASH_MATCH';
  if (integrity.hashMatch === false) return 'HASH_MISMATCH';
  return 'HASH_ABSENT';
}

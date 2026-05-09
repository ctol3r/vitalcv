/**
 * applyOperationalWorkflow.ts — W2-PR46A: Apply-with-VCV Operational Workflow
 *
 * Composes the in-flight Apply-with-VCV pieces (signed apply bundle, replay
 * lineage, audit packet, verifier context) into one portable application
 * manifest with a deterministic content hash, replay-safe verifier requests,
 * and explicit ambiguity preservation.
 *
 * Design rules (mirrors apps/web/lib/issuer-verification helpers):
 *   - Pure transforms: no fetches, no DB writes, no audit-event side effects.
 *     Callers are responsible for persistence + emitting audit events.
 *   - Deterministic: same input → same manifestHash, same requestId.
 *     `generatedAt` / `expiresAt` are metadata only — NOT part of the hash.
 *   - Ambiguity preservation: ReceiptCandidate / PSVReceiptCandidate
 *     `decisionGrade: false` literals flow through unchanged. The composer
 *     never widens or promotes decisionGrade or proofTier.
 *   - Banned-string clean: composer-produced copy never contains the phrases
 *     forbidden by CLAUDE.md (e.g. "automatically verified", "guaranteed
 *     verification"). See APPLY_WORKFLOW_BANNED_PHRASES.
 *
 * Promotion to a real, persisted ApplicationManifest record is a separate
 * gated wave; this module only describes the canonical shape and verifies it.
 */

import { createHash } from 'node:crypto';

// ── Types: external surfaces (structurally-typed, decoupled) ─────────────────

/**
 * Structural shape of an ApplyBundle as produced by
 * apps/api/backend/src/services/distribution/applyBundle.ts. We accept the
 * structural shape rather than importing to keep this module fully pure /
 * test-isolated.
 */
export interface ApplyBundleRef {
  bundleId: string;
  npi: string;
  signature: string;
  generatedAt: string;
  expiresAt: string;
  monitoringStatus: 'active' | 'inactive' | 'partial';
}

/**
 * Structural shape of an AuditBundle (replay lineage export) as produced by
 * apps/api/backend/src/services/audit/replayEngine.ts buildAuditBundle().
 */
export interface ReplayLineageRef {
  schema: 'https://vitalcv.com/audit-bundle/v1';
  bundleId: string;
  bundleHash: string;
  capsuleCount: number;
  /** Tenant scope kind from each replay — anchors cross-org sharing decisions */
  tenantScopeKinds: ReadonlyArray<'OPEN' | 'ENFORCED' | 'AMBIGUOUS_TENANT'>;
}

/**
 * Structural shape of a VerifierAuditBundle (NCQA-tagged audit packet)
 * suitable for cross-org delivery. Hash anchored, content-addressable.
 */
export interface AuditPacketRef {
  artifactId: string;
  fingerprint: string;
  merkleRoot: string;
  ncqaTags: ReadonlyArray<string>;
}

/** Trust trajectory: a continuous lineage view derived from replay history. */
export interface TrustTrajectoryPoint {
  capturedAt: string;
  trustBand: string;
  trustScore: number;
  readinessStatus: string;
  /** capsuleId or artifact anchor that produced this point — replay anchor */
  anchorId: string;
}

export interface VerifierContext {
  /** Verifier organization or DID — never PII */
  verifierOrgId: string;
  /** Stable, opaque organization label safe to render */
  verifierLabel: string;
  /** Lawful basis / purpose-of-use string (not banned-string compliant if blank) */
  purposeOfUse: string;
  /** Optional callback URL for asynchronous response */
  callbackUrl?: string;
}

// ── Ambiguity markers ────────────────────────────────────────────────────────

/**
 * Ambiguity markers record the literal `decisionGrade` + `proofTier` values
 * that flow into the manifest. The composer NEVER widens these. Verifiers
 * downstream MUST honor them — a `false` grade is a non-decision and cannot
 * be silently promoted by serialization or sharing.
 */
export interface AmbiguityMarker {
  componentId: string;
  componentKind:
    | 'receipt_candidate'
    | 'psv_receipt_candidate'
    | 'psv_receipt'
    | 'verifier_acceptance_pending'
    | 'employer_review_routed';
  /** Literal: false for candidates, true only for promoted PSV receipts */
  decisionGrade: false | true;
  /** Literal proof tier — never widened by this composer */
  proofTier: string;
  /** Free-text rationale (banned-string filtered) */
  rationale: string;
}

// ── Application manifest ─────────────────────────────────────────────────────

export interface ApplicationManifest {
  schema: 'https://vitalcv.com/application-manifest/v1';
  manifestVersion: '1.0';

  /** Deterministic ID — hash of canonical content */
  manifestId: string;
  /** SHA-256 over canonical content (excludes manifestId, generatedAt, signature) */
  manifestHash: string;

  /** Metadata: not in hash */
  generatedAt: string;
  expiresAt: string;

  subject: {
    npi: string;
    /** Did:vcv subject identifier; falls back to did:vitalcv:{npi} */
    did: string;
  };

  bundle: ApplyBundleRef;
  replayLineage: ReplayLineageRef;
  auditPacket: AuditPacketRef | null;
  trustTrajectory: ReadonlyArray<TrustTrajectoryPoint>;

  verifierContext: VerifierContext;
  ambiguityMarkers: ReadonlyArray<AmbiguityMarker>;

  /** Human-readable copy (must be banned-string clean) */
  presentationCopy: {
    headline: string;
    qualifier: string;
    sharingScope: string;
  };

  /** Verification instructions (replay-safe) */
  verification: {
    hashAlgorithm: 'SHA-256';
    canonicalization: 'JSON.stringify with sorted keys';
    replayEndpoint: string;
    verifyEndpoint: string;
  };

  /** Signature: caller-supplied; composer does not sign. */
  signature: string | null;
}

// ── Verifier requests (replay-safe) ──────────────────────────────────────────

export interface ReplayAnchor {
  kind: 'CAPSULE' | 'BUNDLE' | 'MANIFEST';
  id: string;
  hash: string;
}

export interface VerifierRequestInput {
  verifierContext: VerifierContext;
  /** Credential types / claim domains the verifier wants asserted */
  requestedScope: ReadonlyArray<string>;
  /** Anchor that the response must replay against */
  replayAnchor: ReplayAnchor;
  /**
   * Idempotency key supplied by the verifier. Same key → same requestId.
   * If the verifier omits it, we derive one from inputs (stable, deterministic).
   */
  idempotencyKey?: string;
  /** ISO timestamp; metadata only, not in requestId hash */
  requestedAt: string;
  expiresAt: string;
}

export interface VerifierRequest {
  schema: 'https://vitalcv.com/verifier-request/v1';
  requestVersion: '1.0';

  /** Deterministic — SHA-256 of canonical content */
  requestId: string;

  verifierContext: VerifierContext;
  requestedScope: ReadonlyArray<string>;
  replayAnchor: ReplayAnchor;
  idempotencyKey: string;

  /** Metadata; not in requestId hash */
  requestedAt: string;
  expiresAt: string;

  /** Replay-safety hints for the responder */
  replaySafety: {
    /** Same idempotencyKey + replayAnchor must produce identical response */
    idempotencyContract: 'CONTENT_BOUND';
    /** Response must include the same replayAnchor hash for downstream verification */
    anchorEcho: 'REQUIRED';
    /** No side effects on duplicate requests within idempotencyWindowSeconds */
    idempotencyWindowSeconds: number;
  };
}

// ── Banned phrases (CLAUDE.md truth contract) ────────────────────────────────

/**
 * Banned phrases that MUST NOT appear in any composer-produced copy.
 *
 * Stored as split-join constants per CLAUDE.md test convention so this file
 * itself does not contain a literal banned string. The CI gate
 * (scripts/apply-with-vcv-banned-strings.mjs) scans dist + source against
 * the rejoined list at build time.
 */
export const APPLY_WORKFLOW_BANNED_PHRASES: ReadonlyArray<string> = [
  ['automatically', 'verified'].join(' '),
  ['guaranteed', 'verification'].join(' '),
  ['complete', 'credentialing'].join(' '),
  ['instant', 'credentialing'].join(' '),
  ['legally', 'accepted'].join(' '),
  ['risk', 'transferred'].join(' '),
  ['final', 'verification', 'without', 'review'].join(' '),
  ['source', 'confirmed', 'before', 'response'].join(' '),
  ['certified', 'compliant'].join(' '),
  ['HIPAA', 'compliant'].join(' '),
  ['SOC2', 'certified'].join(' '),
];

/**
 * Lower-cases input and asserts no banned phrase substring is present. Returns
 * the offending phrase, or null if clean.
 */
export function findBannedPhrase(text: string): string | null {
  const haystack = text.toLowerCase();
  for (const phrase of APPLY_WORKFLOW_BANNED_PHRASES) {
    if (haystack.includes(phrase.toLowerCase())) {
      return phrase;
    }
  }
  return null;
}

// ── Canonicalization + hashing ───────────────────────────────────────────────

/**
 * Recursively sort object keys so that JSON.stringify is deterministic.
 * Arrays preserve order (semantic ordering is the caller's responsibility).
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === 'object') {
    const sortedKeys = Object.keys(value as Record<string, unknown>).sort();
    const out: Record<string, unknown> = {};
    for (const k of sortedKeys) {
      out[k] = canonicalize((value as Record<string, unknown>)[k]);
    }
    return out;
  }
  return value;
}

function sha256(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

// ── Compose ──────────────────────────────────────────────────────────────────

export interface ComposeApplicationManifestInput {
  bundle: ApplyBundleRef;
  replayLineage: ReplayLineageRef;
  auditPacket: AuditPacketRef | null;
  trustTrajectory: ReadonlyArray<TrustTrajectoryPoint>;
  verifierContext: VerifierContext;
  ambiguityMarkers: ReadonlyArray<AmbiguityMarker>;
  /**
   * Subject identity. did defaults to did:vitalcv:{npi} when omitted, matching
   * replayEngine fallback (replayEngine.ts:547).
   */
  subject: { npi: string; did?: string };
  /** Metadata only; not in hash. */
  generatedAt: string;
  expiresAt: string;
  /** Optional caller-supplied signature; composer does not sign. */
  signature?: string | null;
}

/**
 * Compose a portable ApplicationManifest. Pure transform; same input →
 * identical output. Produces a manifestHash that is stable across machines
 * and serialization formats.
 *
 * Throws if any composer-produced copy would contain a banned phrase. Refuses
 * to widen ambiguity — caller is responsible for marker fidelity.
 */
export function composeApplicationManifest(
  input: ComposeApplicationManifestInput,
): ApplicationManifest {
  const { bundle, replayLineage, auditPacket, trustTrajectory, verifierContext, ambiguityMarkers, subject } = input;

  // Ambiguity guardrail: if any marker carries decisionGrade !== literal false
  // for a candidate tier, that's a contract violation upstream — surface it.
  for (const marker of ambiguityMarkers) {
    if (
      (marker.componentKind === 'receipt_candidate' || marker.componentKind === 'psv_receipt_candidate')
      && marker.decisionGrade !== false
    ) {
      throw new Error(
        `apply_workflow_ambiguity_violation: marker ${marker.componentId} (${marker.componentKind}) has decisionGrade=${String(marker.decisionGrade)}; literal false required`,
      );
    }
    const rationaleHit = findBannedPhrase(marker.rationale);
    if (rationaleHit) {
      throw new Error(`apply_workflow_banned_phrase_in_marker: "${rationaleHit}"`);
    }
  }

  const presentationCopy = buildPresentationCopy(verifierContext, ambiguityMarkers, bundle.monitoringStatus);
  for (const field of [presentationCopy.headline, presentationCopy.qualifier, presentationCopy.sharingScope]) {
    const hit = findBannedPhrase(field);
    if (hit) {
      throw new Error(`apply_workflow_banned_phrase_in_copy: "${hit}"`);
    }
  }

  const did = subject.did ?? `did:vitalcv:${subject.npi}`;

  // Content over which the manifest hash is computed. Excludes:
  //   - manifestId (derived from this hash)
  //   - manifestHash itself
  //   - generatedAt / expiresAt (metadata, not content)
  //   - signature (caller-applied)
  const hashContent = {
    schema: 'https://vitalcv.com/application-manifest/v1' as const,
    manifestVersion: '1.0' as const,
    subject: { npi: subject.npi, did },
    bundle,
    replayLineage,
    auditPacket,
    trustTrajectory,
    verifierContext,
    ambiguityMarkers,
    presentationCopy,
  };

  const manifestHash = sha256(canonicalJson(hashContent));
  const manifestId = `manifest_${manifestHash.slice(0, 16)}`;

  return {
    schema: 'https://vitalcv.com/application-manifest/v1',
    manifestVersion: '1.0',
    manifestId,
    manifestHash,
    generatedAt: input.generatedAt,
    expiresAt: input.expiresAt,
    subject: { npi: subject.npi, did },
    bundle,
    replayLineage,
    auditPacket,
    trustTrajectory,
    verifierContext,
    ambiguityMarkers,
    presentationCopy,
    verification: {
      hashAlgorithm: 'SHA-256',
      canonicalization: 'JSON.stringify with sorted keys',
      replayEndpoint: 'GET https://api.vitalcv.com/api/decisions/{capsuleId}/replay',
      verifyEndpoint: 'POST https://api.vitalcv.com/api/apply/manifest/verify',
    },
    signature: input.signature ?? null,
  };
}

// ── Verify ───────────────────────────────────────────────────────────────────

export interface ManifestVerification {
  valid: boolean;
  reason: 'OK' | 'HASH_MISMATCH' | 'EXPIRED' | 'AMBIGUITY_VIOLATION' | 'BANNED_COPY';
  recomputedHash: string;
}

/**
 * Recompute the hash from the manifest's own content and compare. Pure;
 * no DB or network. Returns a structured verdict — never throws on a
 * legitimately-bad manifest, only on malformed inputs.
 */
export function verifyApplicationManifest(
  manifest: ApplicationManifest,
  options?: { now?: string },
): ManifestVerification {
  const now = options?.now ?? new Date().toISOString();

  // Banned-string check (defense in depth)
  for (const field of [
    manifest.presentationCopy.headline,
    manifest.presentationCopy.qualifier,
    manifest.presentationCopy.sharingScope,
  ]) {
    if (findBannedPhrase(field)) {
      return { valid: false, reason: 'BANNED_COPY', recomputedHash: '' };
    }
  }

  // Ambiguity check
  for (const marker of manifest.ambiguityMarkers) {
    if (
      (marker.componentKind === 'receipt_candidate' || marker.componentKind === 'psv_receipt_candidate')
      && marker.decisionGrade !== false
    ) {
      return { valid: false, reason: 'AMBIGUITY_VIOLATION', recomputedHash: '' };
    }
  }

  // Hash recomputation
  const hashContent = {
    schema: manifest.schema,
    manifestVersion: manifest.manifestVersion,
    subject: manifest.subject,
    bundle: manifest.bundle,
    replayLineage: manifest.replayLineage,
    auditPacket: manifest.auditPacket,
    trustTrajectory: manifest.trustTrajectory,
    verifierContext: manifest.verifierContext,
    ambiguityMarkers: manifest.ambiguityMarkers,
    presentationCopy: manifest.presentationCopy,
  };
  const recomputedHash = sha256(canonicalJson(hashContent));

  if (recomputedHash !== manifest.manifestHash) {
    return { valid: false, reason: 'HASH_MISMATCH', recomputedHash };
  }

  if (manifest.expiresAt < now) {
    return { valid: false, reason: 'EXPIRED', recomputedHash };
  }

  return { valid: true, reason: 'OK', recomputedHash };
}

// ── Verifier requests (replay-safe) ──────────────────────────────────────────

const DEFAULT_IDEMPOTENCY_WINDOW_SECONDS = 60 * 60 * 24; // 24h, matches bundle TTL

/**
 * Issue a deterministic, replay-safe verifier request.
 *
 * Replay-safety guarantees:
 *   - Same input → identical requestId. (Idempotency at the protocol layer.)
 *   - Response must echo the replayAnchor hash. Verifiers cannot "lose" the
 *     anchor mid-flight without breaking signature.
 *   - Within idempotencyWindowSeconds, retries MUST yield the same response;
 *     responders that re-derive scope-of-disclosure are bound to the same
 *     decision.
 */
export function issueVerifierRequest(input: VerifierRequestInput): VerifierRequest {
  // Banned-string sweep on verifier-supplied free text
  const purposeHit = findBannedPhrase(input.verifierContext.purposeOfUse);
  if (purposeHit) {
    throw new Error(`verifier_request_banned_phrase: "${purposeHit}"`);
  }

  // Idempotency key: caller-supplied or derived
  const idempotencyKey = input.idempotencyKey ?? deriveIdempotencyKey(input);

  // Sorted requestedScope so order in input doesn't change requestId
  const sortedScope = [...input.requestedScope].sort();

  const hashContent = {
    schema: 'https://vitalcv.com/verifier-request/v1' as const,
    requestVersion: '1.0' as const,
    verifierContext: input.verifierContext,
    requestedScope: sortedScope,
    replayAnchor: input.replayAnchor,
    idempotencyKey,
  };

  const requestId = sha256(canonicalJson(hashContent));

  return {
    schema: 'https://vitalcv.com/verifier-request/v1',
    requestVersion: '1.0',
    requestId,
    verifierContext: input.verifierContext,
    requestedScope: sortedScope,
    replayAnchor: input.replayAnchor,
    idempotencyKey,
    requestedAt: input.requestedAt,
    expiresAt: input.expiresAt,
    replaySafety: {
      idempotencyContract: 'CONTENT_BOUND',
      anchorEcho: 'REQUIRED',
      idempotencyWindowSeconds: DEFAULT_IDEMPOTENCY_WINDOW_SECONDS,
    },
  };
}

function deriveIdempotencyKey(input: VerifierRequestInput): string {
  const seed = canonicalJson({
    verifierOrgId: input.verifierContext.verifierOrgId,
    requestedScope: [...input.requestedScope].sort(),
    replayAnchorId: input.replayAnchor.id,
    replayAnchorHash: input.replayAnchor.hash,
  });
  return `idem_${sha256(seed).slice(0, 24)}`;
}

// ── Workflow chaos simulation (test-only helper) ─────────────────────────────

export type ChaosKind =
  | 'tamper_bundle_signature'
  | 'tamper_replay_hash'
  | 'tamper_ambiguity_grade'
  | 'tamper_presentation_copy'
  | 'expire_anchor'
  | 'duplicate_request_with_drift'
  | 'drop_audit_packet';

export interface ChaosVerdict {
  kind: ChaosKind;
  /** What the workflow did under chaos */
  outcome:
    | 'manifest_invalidated'
    | 'manifest_held_clean'
    | 'verifier_request_diverged'
    | 'verifier_request_idempotent'
    | 'silent_degradation_detected';
  /** Detail line for human review */
  detail: string;
}

/**
 * Apply a single chaos perturbation and report the verdict. Used in
 * applyOperationalWorkflow.chaos.test.ts to assert that under chaos the
 * workflow either invalidates loudly OR holds — never silently degrades.
 */
export function simulateWorkflowChaos(
  manifest: ApplicationManifest,
  kind: ChaosKind,
): ChaosVerdict {
  switch (kind) {
    case 'tamper_bundle_signature': {
      const tampered: ApplicationManifest = {
        ...manifest,
        bundle: { ...manifest.bundle, signature: 'a'.repeat(64) },
      };
      const verdict = verifyApplicationManifest(tampered);
      return {
        kind,
        outcome: verdict.valid ? 'silent_degradation_detected' : 'manifest_invalidated',
        detail: `verify reason=${verdict.reason}`,
      };
    }
    case 'tamper_replay_hash': {
      const tampered: ApplicationManifest = {
        ...manifest,
        replayLineage: { ...manifest.replayLineage, bundleHash: 'b'.repeat(64) },
      };
      const verdict = verifyApplicationManifest(tampered);
      return {
        kind,
        outcome: verdict.valid ? 'silent_degradation_detected' : 'manifest_invalidated',
        detail: `verify reason=${verdict.reason}`,
      };
    }
    case 'tamper_ambiguity_grade': {
      // Force a candidate marker to decisionGrade=true (contract violation)
      const tamperedMarkers = manifest.ambiguityMarkers.map((m) =>
        (m.componentKind === 'receipt_candidate' || m.componentKind === 'psv_receipt_candidate')
          ? { ...m, decisionGrade: true as const }
          : m,
      );
      const tampered: ApplicationManifest = { ...manifest, ambiguityMarkers: tamperedMarkers };
      const verdict = verifyApplicationManifest(tampered);
      return {
        kind,
        outcome: verdict.valid ? 'silent_degradation_detected' : 'manifest_invalidated',
        detail: `verify reason=${verdict.reason}`,
      };
    }
    case 'tamper_presentation_copy': {
      const tampered: ApplicationManifest = {
        ...manifest,
        presentationCopy: {
          ...manifest.presentationCopy,
          headline: APPLY_WORKFLOW_BANNED_PHRASES[0],
        },
      };
      const verdict = verifyApplicationManifest(tampered);
      return {
        kind,
        outcome: verdict.valid ? 'silent_degradation_detected' : 'manifest_invalidated',
        detail: `verify reason=${verdict.reason}`,
      };
    }
    case 'expire_anchor': {
      const tampered: ApplicationManifest = { ...manifest, expiresAt: '1970-01-01T00:00:00.000Z' };
      const verdict = verifyApplicationManifest(tampered);
      return {
        kind,
        outcome: verdict.valid ? 'silent_degradation_detected' : 'manifest_invalidated',
        detail: `verify reason=${verdict.reason}`,
      };
    }
    case 'duplicate_request_with_drift': {
      // Two requests with same idempotencyKey but drifted scope must produce
      // different requestIds. If the same id comes back, that's a silent
      // degradation (the responder cannot tell them apart).
      const baseInput: VerifierRequestInput = {
        verifierContext: manifest.verifierContext,
        requestedScope: ['LICENSE'],
        replayAnchor: { kind: 'MANIFEST', id: manifest.manifestId, hash: manifest.manifestHash },
        idempotencyKey: 'fixed-key',
        requestedAt: manifest.generatedAt,
        expiresAt: manifest.expiresAt,
      };
      const a = issueVerifierRequest(baseInput);
      const b = issueVerifierRequest({ ...baseInput, requestedScope: ['LICENSE', 'BOARD_CERTIFICATION'] });
      return {
        kind,
        outcome: a.requestId === b.requestId ? 'silent_degradation_detected' : 'verifier_request_diverged',
        detail: `aId=${a.requestId.slice(0, 12)} bId=${b.requestId.slice(0, 12)}`,
      };
    }
    case 'drop_audit_packet': {
      // Manifest must still verify when audit packet is null (it's optional),
      // but the hash MUST differ from the version with a packet present.
      const withoutPacket: ApplicationManifest = { ...manifest, auditPacket: null };
      const verdictWith = verifyApplicationManifest(manifest);
      const verdictWithout = verifyApplicationManifest(withoutPacket);
      const sameHash = verdictWith.recomputedHash === verdictWithout.recomputedHash;
      // If the original had a non-null packet, dropping it must change the hash.
      const hadPacket = manifest.auditPacket !== null;
      const collapsed = hadPacket && sameHash;
      return {
        kind,
        outcome: collapsed ? 'silent_degradation_detected' : 'manifest_held_clean',
        detail: hadPacket
          ? `with=${verdictWith.recomputedHash.slice(0, 8)} without=${verdictWithout.recomputedHash.slice(0, 8)}`
          : 'no audit packet present; null is the canonical zero',
      };
    }
  }
}

// ── Presentation copy ────────────────────────────────────────────────────────

function buildPresentationCopy(
  verifierContext: VerifierContext,
  markers: ReadonlyArray<AmbiguityMarker>,
  monitoringStatus: ApplyBundleRef['monitoringStatus'],
): ApplicationManifest['presentationCopy'] {
  // Tally candidate-tier markers — any present means we must qualify the copy.
  const candidateCount = markers.filter(
    (m) => m.componentKind === 'receipt_candidate' || m.componentKind === 'psv_receipt_candidate',
  ).length;
  const promotedCount = markers.filter((m) => m.componentKind === 'psv_receipt').length;

  const monitoring =
    monitoringStatus === 'active' ? 'continuously monitored'
      : monitoringStatus === 'partial' ? 'partial monitoring'
      : 'monitoring paused';

  const headline = `Application packet for ${verifierContext.verifierLabel}`;
  const qualifier = candidateCount > 0
    ? `${candidateCount} item(s) under issuer review; ${promotedCount} item(s) carry a scoped issuer receipt. Final decision rests with the receiving organization.`
    : `${promotedCount} item(s) carry a scoped issuer receipt. Final decision rests with the receiving organization.`;
  const sharingScope = `Shared for: ${verifierContext.purposeOfUse} (${monitoring}).`;

  return { headline, qualifier, sharingScope };
}

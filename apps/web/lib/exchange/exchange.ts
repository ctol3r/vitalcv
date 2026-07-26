/**
 * Professional Trust Exchange (Wave 800)
 * ──────────────────────────────────────────────────────────────────────────
 * One shared, honest contract for moving source-backed career evidence between
 * participants (issuer → holder → verifier) across an organization federation.
 *
 * The load-bearing honesty rule: **trust is never transmitted, only evidence
 * is.** An issuer packages a clinician's `EvidenceCollection` into a signed,
 * portable envelope. The signature proves *integrity + origin* (the bytes were
 * not tampered, and the sender holds the federation secret) — nothing more. The
 * receiving verifier RE-DERIVES trust and readiness itself, from the exchanged
 * evidence, using the same monotonic, non-inflating projections every surface
 * uses. No participant can hand another a higher trust score than the evidence
 * supports; a downstream verifier with a stricter policy may even derive less.
 *
 * Reuses, no rewrites:
 *  - HMAC primitive: `computeSignature` / `verifyWebhookSignature` (platform).
 *  - Trust engine:   `projectEvidenceToGraph` → `propagateTrust` (domain-evidence).
 *  - Readiness:      `defaultReadinessTemplate` → `projectReadiness`.
 */
import {
  buildEvidenceCollection,
  projectEvidenceToGraph,
  propagateTrust,
  defaultReadinessTemplate,
  detectGaps,
  projectReadiness,
  type EvidenceCollection,
  type TrustProjection,
  type ReadinessProjection,
} from '@vitalcv/domain-evidence';
import { computeSignature, verifyWebhookSignature } from '@/lib/platform/webhook';

export const EVIDENCE_EXCHANGE_SCHEMA = 'vitalcv.trust-exchange.v1' as const;
export const EXCHANGE_VERDICT_SCHEMA = 'vitalcv.trust-exchange-verdict.v1' as const;

/**
 * The signed, portable artifact that moves between participants. Everything
 * except `signature` is covered by the signature.
 */
export interface EvidenceExchange {
  schema: typeof EVIDENCE_EXCHANGE_SCHEMA;
  /** Federation member key of the packaging participant (issuer/org). */
  issuer: string;
  /** Subject (clinician) key — matches `collection.subjectKey`. */
  subjectKey: string;
  /** ISO-8601 issuance time, bound into the signature (replay context). */
  issuedAt: string;
  /** The source-backed evidence being shared. Decision-grade ⇔ status checked. */
  collection: EvidenceCollection;
  /** `sha256=<hex>` over `${issuedAt}.${canonicalBody}`. */
  signature: string;
}

/** Canonical, signature-covered body (envelope minus the signature itself). */
function canonicalBody(input: {
  issuer: string;
  subjectKey: string;
  issuedAt: string;
  collection: EvidenceCollection;
}): string {
  return JSON.stringify({
    schema: EVIDENCE_EXCHANGE_SCHEMA,
    issuer: input.issuer,
    subjectKey: input.subjectKey,
    issuedAt: input.issuedAt,
    collection: input.collection,
  });
}

/**
 * Issuer side (C1). Package a clinician's collection into a signed exchange.
 * `issuedAt` is injected for determinism (no clock in the pure layer).
 *
 * The collection is re-built through `buildEvidenceCollection`, which fails
 * closed on any `decisionGrade` ↔ status mismatch — so a tampered or hand-rolled
 * collection cannot be signed into the federation.
 */
export function buildEvidenceExchange(input: {
  issuer: string;
  collection: EvidenceCollection;
  secret: string;
  issuedAt: string;
}): EvidenceExchange {
  const issuer = input.issuer.trim();
  if (!issuer) throw new Error('exchange issuer is required');
  if (!input.secret) throw new Error('exchange secret is required');

  // Re-validate the collection through the canonical builder (fails closed).
  const collection = buildEvidenceCollection({
    subjectKey: input.collection.subjectKey,
    generatedFor: input.collection.generatedFor,
    objects: input.collection.objects,
    relationships: input.collection.relationships,
  });

  const subjectKey = collection.subjectKey;
  const body = canonicalBody({ issuer, subjectKey, issuedAt: input.issuedAt, collection });
  const signature = computeSignature(input.issuedAt, body, input.secret);

  return { schema: EVIDENCE_EXCHANGE_SCHEMA, issuer, subjectKey, issuedAt: input.issuedAt, collection, signature };
}

/**
 * Integrity + origin check (C2/C3). Timing-safe; recomputes the signature over
 * the canonical body. Returns false on any structural drift or wrong secret.
 */
export function verifyExchangeSignature(exchange: EvidenceExchange, secret: string): boolean {
  if (!exchange || exchange.schema !== EVIDENCE_EXCHANGE_SCHEMA) return false;
  if (!secret) return false;
  const body = canonicalBody(exchange);
  return verifyWebhookSignature({
    body,
    timestamp: exchange.issuedAt,
    signature: exchange.signature,
    secret,
  });
}

/**
 * The verdict a verifier produces from a received exchange. `trust` and
 * `readiness` are RE-DERIVED here — they are the verifier's own conclusion, not
 * a value copied from the issuer.
 */
export interface ExchangeVerdict {
  schema: typeof EXCHANGE_VERDICT_SCHEMA;
  subjectKey: string;
  issuer: string;
  issuedAt: string;
  /** True only if the signature verifies against the verifier's federation secret. */
  signatureValid: boolean;
  /** Verifier-derived trust over the *exchanged* evidence. Null when not accepted. */
  trust: TrustProjection | null;
  /** Verifier-derived readiness against its own requirement template. */
  readiness: ReadinessProjection | null;
  /**
   * Always literal false: an exchange moves evidence, not a decision. The
   * verifier's own derived `trust`/`readiness` are the decision inputs.
   */
  trustTransferred: false;
  /** Human-readable basis for the outcome. */
  note: string;
}

/**
 * Verifier side (C2/C6). Verify integrity, then — only if valid — RE-DERIVE
 * trust and readiness from the exchanged evidence. On signature failure the
 * verifier fails closed: no trust, no readiness, nothing accepted.
 *
 * `template` lets the verifier apply its OWN policy/requirements; omitted ⇒ the
 * default decision-grade template. This is why two verifiers can honestly reach
 * different readiness on the same exchange — trust was never transferred.
 */
export function evaluateExchange(
  exchange: EvidenceExchange,
  secret: string,
  options?: { state?: string; specialty?: string },
): ExchangeVerdict {
  const base = {
    schema: EXCHANGE_VERDICT_SCHEMA,
    subjectKey: exchange?.subjectKey ?? '',
    issuer: exchange?.issuer ?? '',
    issuedAt: exchange?.issuedAt ?? '',
    trustTransferred: false as const,
  };

  if (!verifyExchangeSignature(exchange, secret)) {
    return {
      ...base,
      signatureValid: false,
      trust: null,
      readiness: null,
      note: 'Signature invalid or sender not in federation — exchange rejected, no trust derived.',
    };
  }

  // Integrity proven. Verifier independently re-derives trust from the evidence.
  const graph = projectEvidenceToGraph(exchange.collection);
  const trust = propagateTrust(graph);
  const template = defaultReadinessTemplate(options?.state, options?.specialty);
  const gaps = detectGaps(template, exchange.collection, trust);
  const readiness = projectReadiness(template, gaps, trust);

  return {
    ...base,
    signatureValid: true,
    trust,
    readiness,
    note: 'Signature valid. Trust and readiness re-derived by the verifier from the exchanged evidence (not transferred).',
  };
}

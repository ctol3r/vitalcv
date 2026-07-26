/**
 * Authorization matrix for the career-graph projection.
 *
 * The graph is an authorization-sensitive projection: every node and edge is
 * filtered server-side, before serialization. Nothing is filtered in the client.
 * Sending a full graph and hiding nodes with CSS is not an implementation of
 * this file — it is a breach of it.
 *
 * ── The honest boundary ──────────────────────────────────────────────────────
 * This matrix is only as strong as the identity underneath it. On origin/main:
 *
 *   - `CLERK_JWT_VERIFICATION` defaults to 'off' (config/env.ts) and is set in
 *     no deploy config in this repo. In 'off' mode the verifiedIdentity
 *     middleware is a no-op and `x-clerk-user-id` flows unverified to its
 *     readers. In 'shadow' it logs mismatches and still calls next().
 *   - `tenantGuard`'s skip-list exempts the `/api/graph/` prefix from org
 *     context entirely.
 *   - `parseRequestRole` reads roles from client-supplied headers, and
 *     super-admin short-circuits the org match.
 *
 * So a projection built today would enforce scope derived partly from values the
 * caller supplies. The one primitive that validates an org claim against
 * persisted state is `resolveSearchRequestContext` / `deriveOrganizationId`
 * (services/search/requestContext.ts), which checks requested org against actual
 * WorkspaceMembership rows — that is what a projection service should reuse.
 *
 * Treat `CLERK_JWT_VERIFICATION=enforce` and a `/api/graph/` tenant-guard entry
 * as prerequisites for exposing anything beyond a self-scoped clinician graph,
 * not as follow-ups.
 */

import type { CareerGraphEdgeType, CareerGraphNodeType } from './types';

export type GraphPerspective =
  /** The clinician themselves, looking at their own career. */
  | 'clinician_self'
  /** A reviewer acting for an organization, scoped to that organization. */
  | 'employer_reviewer'
  /** Administrative traversal — explicit authorization, always audited. */
  | 'admin'
  /** Unauthenticated. */
  | 'public';

export interface PerspectiveRule {
  readonly perspective: GraphPerspective;
  /** Node types this perspective may ever see. */
  readonly visibleNodes: readonly CareerGraphNodeType[];
  /** Edge types this perspective may ever see. */
  readonly visibleEdges: readonly CareerGraphEdgeType[];
  /**
   * The server-side predicate every projected row must satisfy. Prose here, but
   * a projection service must implement exactly this — it is the scope, and the
   * visible* lists above are only the type filter.
   */
  readonly scope: string;
  /** Must administrative traversal be recorded? */
  readonly audited: boolean;
}

/**
 * Types a perspective must never receive, with the reason. Separate from simply
 * being absent from `visibleNodes` because these are the ones a plausible future
 * change might quietly add — the contract test pins them.
 */
export interface Denial {
  readonly perspective: GraphPerspective;
  readonly nodeType?: CareerGraphNodeType;
  readonly edgeType?: CareerGraphEdgeType;
  readonly reason: string;
}

export const PERSPECTIVE_RULES: readonly PerspectiveRule[] = [
  {
    perspective: 'clinician_self',
    visibleNodes: [
      'clinician',
      'identity',
      'npi',
      'evidence_claim',
      'source_receipt',
      'credential',
      'preference',
      'organization',
      'opportunity',
      'application',
      'application_packet',
      'consent_receipt',
      'decision',
      'recognition',
      'start_attestation',
      'source',
    ],
    visibleEdges: [
      'owns',
      'has_identity',
      'holds',
      'backed_by',
      'observed_by',
      'supersedes',
      'states_preference',
      'offered_by',
      'interested_in',
      'passed_on',
      'applied_to',
      'presented_in',
      'consented_to',
      'decided_by',
      'produced_recognition',
      'started_at',
    ],
    scope:
      'Every row must trace to this clinician: subjectNpi / clerkUserId / userId equals the verified caller. Decisions only where the decision was disclosed to them. Never another clinician’s node, at any depth.',
    audited: false,
  },
  {
    perspective: 'employer_reviewer',
    visibleNodes: [
      'organization',
      'opportunity',
      'application',
      'application_packet',
      'consent_receipt',
      'decision',
      'recognition',
      'start_attestation',
      'evidence_claim',
      'source_receipt',
      'source',
      'clinician',
    ],
    visibleEdges: [
      'offered_by',
      'applied_to',
      'presented_in',
      'consented_to',
      'backed_by',
      'observed_by',
      'decided_by',
      'produced_recognition',
      'started_at',
    ],
    scope:
      'organizationId must equal an org the caller holds an ACTIVE WorkspaceMembership in, validated against persisted rows — never taken from a header or query param. Applications only where the application targets this org. Packets only those this org is authorized to review, reached through the application. evidence_claim/source_receipt ONLY as contained in such a packet — never the clinician’s wallet at large. clinician limited to the applicant, and only the fields the packet disclosed.',
    audited: false,
  },
  {
    perspective: 'admin',
    visibleNodes: [],
    visibleEdges: [],
    scope:
      'Deliberately empty. Administrative traversal requires explicit administrative authorization and must be recorded; it is not a superset granted by a header. Note enforceOrganizationMatch currently returns true immediately for a client-supplied x-user-role: super-admin — that path must not become the admin graph.',
    audited: true,
  },
  {
    perspective: 'public',
    visibleNodes: [],
    visibleEdges: [],
    scope:
      'No public clinician career graph by default. Any public projection requires explicit clinician-controlled publication with field-level disclosure, and is a separate gated decision — not a relaxation of this rule.',
    audited: false,
  },
];

/**
 * Explicit denials. These encode the directive’s "employers must not see"
 * list, which is otherwise only enforceable by remembering it.
 */
export const DENIALS: readonly Denial[] = [
  {
    perspective: 'employer_reviewer',
    edgeType: 'passed_on',
    reason:
      'A clinician passing on a role is private. An employer learning they were declined — or that a clinician is browsing at all — is a disclosure the clinician never consented to.',
  },
  {
    perspective: 'employer_reviewer',
    edgeType: 'interested_in',
    reason:
      'Interest is a private signal until the clinician applies. Applying is the deliberate, consented act; interest is not.',
  },
  {
    perspective: 'employer_reviewer',
    nodeType: 'preference',
    reason:
      'Stated preferences are the clinician’s own. An employer may see what a packet disclosed, not the preference model behind it.',
  },
  {
    perspective: 'employer_reviewer',
    nodeType: 'wallet',
    reason:
      'The wallet is the clinician’s home base. Employers see the packet that was presented to them, never the wallet it was drawn from.',
  },
  {
    perspective: 'public',
    nodeType: 'evidence_claim',
    reason:
      'Evidence is not public. Public verification surfaces expose salted digests, not claim contents.',
  },
];

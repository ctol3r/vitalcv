import { TruthBoundary } from '@/components/TruthBoundary';

/**
 * /truth-boundary — institutional compliance officer view.
 *
 * The 10-second-comprehension target lives here. Compliance officer
 * scrolls once and knows:
 *   - What VitalCV verifies (top)
 *   - What VitalCV does NOT verify (just below)
 *   - Live operational state of each backing system
 *   - Known limitations
 *   - The 7-state verification matrix legend
 *
 * Data on this demo route is the operational baseline — what the
 * system claims today, on origin/main, NOT aspirationally. Real
 * production consumers will pass live state in from
 * /api/passport/[npi] + /status-list/* + /api/me/jwks-status + the
 * AuditExport Prisma table (#319) once the wiring PRs (W3-PR213A,
 * EXPORT-PERSIST-WIRE, STATUS-PERSIST-WIRE) land.
 */
export default function TruthBoundaryPage() {
  return (
    <TruthBoundary
      verified={[
        {
          claim: 'NPI identity exists and is active',
          source: 'NPPES (CMS federal NPI registry)',
        },
        {
          claim: 'OIG / LEIE exclusion status',
          source: 'HHS OIG Exclusions database',
        },
        {
          claim: 'Medicare enrollment status (PECOS)',
          source: 'CMS PECOS',
        },
        {
          claim: 'Clinician session authentication',
          source: 'Clerk (with configured IdPs — see /sign-in)',
        },
      ]}
      notVerified={[
        {
          claim: 'Clinical competence or skill',
          reason:
            'Out of scope. VitalCV verifies credentials; competence is the employer’s assessment.',
          state: 'unavailable',
        },
        {
          claim: 'Malpractice history detail',
          reason:
            'Gated. NPDB query requires institutional access; VitalCV surfaces only what the partner institution shares.',
          state: 'gated',
        },
        {
          claim: 'Employer-specific privileging',
          reason:
            'Out of scope. Privileging is a per-employer credentialing committee outcome, not a public source check.',
          state: 'unavailable',
        },
        {
          claim: 'Board certification claims without source receipt',
          reason:
            'Self-asserted unless an ABMS/AOA receipt is attached. Without a receipt, the claim is unverified.',
          state: 'self-attested',
        },
        {
          claim: 'Continuing education credits',
          reason:
            'Self-asserted. No automated source feed integrated today.',
          state: 'self-attested',
        },
        {
          claim: 'Workplace history (employer, dates, role)',
          reason:
            'Self-asserted unless explicitly source-verified by a participating employer.',
          state: 'self-attested',
        },
        {
          claim: 'State board action history beyond public LEIE',
          reason:
            'Coverage varies by jurisdiction; many state board adapters are not yet integrated.',
          state: 'unavailable',
        },
      ]}
      operationalState={{
        replayLineage: {
          state: 'ambiguous',
          detail:
            'Web-side primitive shipped (PR #312). Backend emitter shipped as primitive (PR #313). Not yet wired into the live passport response — pending W3-PR213A.',
        },
        revocation: {
          state: 'ambiguous',
          detail:
            'apps/status-api runs the StatusList2021 surface (PR #317 audit). Persistence is in-memory until the durable schema migration runs (PR #319 + STATUS-PERSIST-WIRE).',
        },
        jwks: {
          state: 'ambiguous',
          detail:
            'apps/web JWKS endpoint is live. apps/web-v2 sandbox JWKS endpoint shipped (PR #316) — serves an empty key set with X-JWKS-Status: not-configured until VITALCV_SIGNING_PUBLIC_JWK is set.',
        },
        auditExport: {
          state: 'ambiguous',
          detail:
            'Signed envelope primitive shipped (PR #318). AuditExport Prisma model shipped (PR #319). Not yet wired into /api/export/packet — pending EXPORT-PERSIST-WIRE.',
        },
      }}
      limitations={[
        'Source coverage varies by US jurisdiction. Some state boards have no automated adapter; those checks fall to self-attested + future manual verification.',
        'Real-time status checks may be cached up to 1 hour at the JWKS endpoint. Verifiers must respect Cache-Control and re-fetch when stale.',
        'No off-US clinician verification. VitalCV operates against US federal/state sources only.',
        'No NPDB malpractice query in the default flow. Institutional partners with NPDB access surface their own findings.',
        'Lineage and signed export are PRIMITIVES today — not yet wired into every consumer route. See operational state above for which surfaces are live.',
      ]}
    />
  );
}

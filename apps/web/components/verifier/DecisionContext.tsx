/**
 * DecisionContext (ACT-1.1) — the real, replayable decision context an employer
 * reviewer sees before acting on a sealed application. Every value is from the
 * frozen packet; nothing is fabricated. Recording a decision is ACT-1.2 — this
 * surface establishes the truthful context the decision will be made against.
 */

import { DecisionPanel } from '@/components/verifier/DecisionPanel';
import type { DecisionContext as DecisionContextData } from '@/lib/applications/decisionContext';

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-[var(--ink-600)]">{label}</dt>
      <dd className={`mt-0.5 text-sm font-medium text-[var(--ink-900)] ${mono ? 'mz-mono break-all' : ''}`}>{value}</dd>
    </div>
  );
}

export function DecisionContext({ context }: { context: DecisionContextData }) {
  const { packet, consent, coverage } = context;

  return (
    <div className="grid gap-6" data-decision-context={context.applicationId}>
      {context.staleOrRevoked ? (
        <div
          className="mz-card mz-card-pad border border-amber-500/40 bg-amber-500/5 text-sm"
          role="status"
          data-packet-lifecycle={packet.lifecycle}
        >
          <p className="font-semibold text-[var(--ink-900)]">
            {packet.lifecycle === 'revoked' ? 'This packet has been revoked.' : 'A newer packet supersedes this one.'}
          </p>
          <p className="mt-1 text-[var(--ink-700)]">
            The submitted evidence below is the sealed record from application time. Confirm you intend to act on this
            version before deciding.
          </p>
        </div>
      ) : null}

      <section className="mz-card mz-card-pad" aria-label="Sealed packet identity">
        <h2 className="mz-h3">Sealed packet</h2>
        <dl className="mt-3 grid grid-cols-2 gap-4">
          <Fact label="Clinician NPI" value={packet.clinicianNpi} mono />
          <Fact label="Packet integrity" value={packet.integrity === 'valid' ? 'Valid (hash matches)' : packet.integrity} />
          <Fact label="Packet version" value={`v${packet.version}`} />
          <Fact label="Lifecycle" value={packet.lifecycle} />
          <Fact label="Packet hash" value={packet.hash} mono />
          <Fact label="Methodology" value={packet.methodologyVersion} />
        </dl>
      </section>

      <section className="mz-card mz-card-pad" aria-label="Consent scope">
        <h2 className="mz-h3">Consent</h2>
        <dl className="mt-3 grid grid-cols-2 gap-4">
          <Fact label="Consented at" value={new Date(consent.consentAt).toLocaleString()} />
          <Fact label="Purpose" value={consent.purpose} />
          <Fact label="Recipient" value={consent.recipient} />
          <Fact label="Sections shared" value={String(consent.selectedSectionCount)} />
          <Fact label="Consent receipt" value={consent.consentReceiptId} mono />
        </dl>
      </section>

      <section className="mz-card mz-card-pad" aria-label="Source coverage">
        <h2 className="mz-h3">Source coverage</h2>
        <p className="mt-1 text-sm text-[var(--ink-700)]">
          {coverage.total} field{coverage.total === 1 ? '' : 's'} in this packet. Source-backed evidence is distinct from
          self-attested; needs-review and unavailable are not adverse.
        </p>
        <dl className="mt-3 grid grid-cols-4 gap-4">
          <Fact label="Source-backed" value={String(coverage.sourceBacked)} />
          <Fact label="Self-attested" value={String(coverage.selfAttested)} />
          <Fact label="Needs review" value={String(coverage.needsReview)} />
          <Fact label="Unavailable" value={String(coverage.unavailable)} />
        </dl>
      </section>

      <DecisionPanel item={context.worklistItem} />
    </div>
  );
}

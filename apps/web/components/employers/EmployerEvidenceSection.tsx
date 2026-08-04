'use client';

import {
  ApplicationEvidenceTimeline,
  ConsentSeal,
  EnterpriseWorkflowCloseup,
  EvidenceInspector,
  ExpandingEyebrow,
  HumanReviewCheckpoint,
  PacketHandoff,
  SourceWorkflowTabs,
} from '@/design-system/components';
import { SOURCE_LANE_OPS } from '@/lib/trust/sourceLanes';

/**
 * /employers — what actually arrives, source by source.
 *
 * This is the first surface to mount the experience component set, and it is on
 * /employers rather than / because the homepage composition is owned by the
 * locked Home Evidence v2 contract.
 *
 * The honesty split here is the whole point, and it is deliberate:
 *
 *  - **The lane register is REAL.** Every tab, every value and every cadence is
 *    read from `SOURCE_LANE_OPS`, the single source of lane truth already behind
 *    `/`, `/status` and `/api/status`. Nothing on it is hand-typed, so this
 *    section cannot drift from lane truth — the same guarantee the page's
 *    existing cadence sentence already relies on. It carries no "illustrative"
 *    note because it is not illustrative.
 *  - **The packet example is ILLUSTRATIVE, and says so.** A consent seal, a
 *    handoff and a review checkpoint for a named hospital would be a fabricated
 *    record if presented as real. They render inside
 *    `EnterpriseWorkflowCloseup`, whose `illustrative` prop defaults to true, so
 *    the "Illustrative — not a live result" note is on by default rather than
 *    remembered.
 *
 * That split is CD-1 in practice: uncertainty rendered with the same confidence
 * as certainty, and no visual implying more than the data supports.
 *
 * CD-20 is why this exists at all. The buyer asymmetry is "they claim numbers,
 * we show one artifact" — and the reference harvest measured what the market
 * does instead: Medallion ships "Trusted by 300+" with a logo wall, Checkr nine
 * unauditable percentages, Palantir's hospital page a 2000% claim. A hospital
 * cannot verify any of those. It can read this.
 */

/** The state a lane is actually in, in the reviewer's words — never softened. */
function laneStanding(lifecycle: string, cadenceLabel: string): { value: string; note: string } {
  switch (lifecycle) {
    case 'active':
      return {
        value: `Read · ${cadenceLabel}`,
        note: 'This lane returns real data at the cadence shown. It is not read continuously.',
      };
    case 'planned':
      return {
        value: `Not read · ${cadenceLabel}`,
        note: 'VitalCV does not read this lane today. Absence here is not a clearance — it means nobody looked.',
      };
    case 'demo_only':
      return {
        value: 'Demonstration only',
        note: 'Synthetic data for demonstration. Do not treat as a finding about any clinician.',
      };
    default:
      return {
        value: 'Not integrated',
        note: 'No connector runs for this lane. Absence here is not a clearance.',
      };
  }
}

export function EmployerEvidenceSection() {
  const tabs = SOURCE_LANE_OPS.map((lane) => {
    const standing = laneStanding(lane.lifecycle, lane.cadenceLabel);
    return {
      id: lane.laneId,
      label: lane.marketingShortName,
      panel: (
        <EvidenceInspector
          title={`${lane.marketingShortName} — what this lane returns`}
          recordId={lane.laneId}
          facts={[
            {
              label: 'Standing',
              value: standing.value,
              source: lane.marketingShortName,
              asOf: lane.cadenceLabel,
              note: standing.note,
            },
            // `detail` and `readinessDimension` are optional/nullable in the
            // registry. An absent field is stated, never rendered blank — a
            // blank reads as "unknown" when the truth is "the registry does not
            // record one" (CD-1: uncertainty rendered as confidently as fact).
            {
              label: 'Behaviour',
              value: lane.detail ?? 'The registry records no behaviour note for this lane.',
              source: 'lib/trust/sourceLanes.ts',
              asOf: 'lane registry',
            },
            {
              label: 'Readiness',
              value: lane.readinessDimension ?? 'Does not map to a readiness dimension.',
              source: lane.marketingShortName,
              asOf: lane.cadenceLabel,
            },
          ]}
          doesNotDecide="Whether this clinician may practise at your facility. A lane result is evidence for your review, not a credentialing decision."
        />
      ),
    };
  });

  return (
    <section aria-label="What arrives, source by source" className="mt-10 flex flex-col gap-6">
      <ExpandingEyebrow detail="Every tab below is read from the same lane registry that drives /status and /api/status. If a lane changes there, it changes here — this page cannot describe a lane it does not have.">
        What arrives, source by source
      </ExpandingEyebrow>

      <SourceWorkflowTabs label="Evidence lanes" tabs={tabs} />

      <ExpandingEyebrow detail="The packet below is an example, not a real clinician. It shows the shape a reviewer receives: what was consented to, how it got there, and who still owes a decision.">
        What a reviewed packet looks like
      </ExpandingEyebrow>

      <EnterpriseWorkflowCloseup caption="A consented packet, the handoff that produced it, and the human decision it is waiting on.">
        <div className="flex flex-col gap-4">
          <ConsentSeal
            grantedTo="Example Health, Tampa"
            scope={['Identity (NPPES)', 'Exclusions (OIG/LEIE)', 'Medicare enrollment (CMS PECOS)']}
            grantedAt="2026-08-01"
            expiresAt="2026-11-01"
            revocationRoute="The clinician can withdraw this at any time from their record. Withdrawal stops future reads; it does not retract what you have already seen."
          />

          <PacketHandoff
            recipient="Example Health, Tampa"
            steps={[
              { label: 'Identity resolved against the federal registry', actor: 'NPPES', at: '2026-08-01 14:02' },
              { label: 'Packet assembled and consented by the clinician', actor: 'Clinician', at: '2026-08-01 14:06' },
              { label: 'Presented to the reviewing team', actor: 'Example Health', at: '2026-08-01 14:09' },
              { label: 'Credentialing decision', actor: 'Example Health', at: null },
            ]}
            expiresAt="2026-11-01"
            doesNotDecide="Credentialing, privileging, or employment. VitalCV prepares the evidence and names its sources; your team decides."
          />

          <HumanReviewCheckpoint
            state="awaiting"
            awaitingWhom="Your credentialing team"
            decision="Whether the evidence gathered is sufficient to start, and what remains outstanding."
            asOf="2026-08-01 14:09"
          />

          <ApplicationEvidenceTimeline
            label="Evidence history for this example packet"
            entries={[
              { event: 'Identity resolved', actor: 'NPPES', at: '2026-08-01 14:02', source: 'read live' },
              { event: 'Exclusion screen run against the current snapshot', actor: 'OIG/LEIE', at: '2026-08-01 14:03', source: 'monthly snapshot' },
              { event: 'Clinician consented to share', actor: 'Clinician', at: '2026-08-01 14:06' },
              { event: 'Packet presented', actor: 'Example Health', at: '2026-08-01 14:09' },
            ]}
          />
        </div>
      </EnterpriseWorkflowCloseup>
    </section>
  );
}

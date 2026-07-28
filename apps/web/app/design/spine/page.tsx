/**
 * /design/spine — the four-step argument as one operable section (prototype).
 *
 * WHAT THIS IS FOR. On the homepage the product's argument — NPI → source
 * evidence → the packet you choose → hospital review — is spread across a
 * ledger, two chapters and three beats, roughly 4,900px apart. A reader meets
 * four labels scattered down a page rather than a sequence they can move
 * through. This prototype collapses them into one pane.
 *
 * The references Chris pointed at, and what each contributes:
 *   dock.io   — a topic list driving ONE persistent pane. Nothing
 *               auto-advances; one thing is on screen at a time. Measured,
 *               not assumed: their control is a 6-item vertical tab list, not
 *               a slider, which is why it does not collide with CD-13's
 *               retirement of the card carousel / horizontal Rolodex.
 *   abridge.com — name the stage, then show the real surface for it.
 *
 * What we deliberately do NOT take from Abridge: the customer-metric cards
 * and the logo wall. Those are earned with customers and measured numbers,
 * and this product has neither yet. Structure is borrowable; proof is not.
 *
 * Step 2 carries REAL registry state (SOURCE_LANE_OPS — the same source
 * /status and /api/status serve, kept honest by the deploy parity gate), so
 * it takes no "illustrative" note and no glass. The other three are drawings
 * and say so. Glass on chrome, solid on evidence (CD-12).
 *
 * Design Handoff References:
 *   docs/design/VITALCV_CREATIVE_DIRECTION.md — CD-11 (explain on entry, then
 *   rest), CD-12 (glass on chrome), CD-13 (no carousel, no pill badges),
 *   CD-14 (evidence-artifact grammar).
 */

import type { Metadata } from 'next';

import { SpineTabs, type SpineStep } from '@/components/home/spine/SpineTabs';
import { CheckRunArtifact, PacketArtifact } from '@/components/home/ask/AskHome';
import { DecisionArtifact } from '@/components/artifacts/PageArtifacts';
import { SOURCE_LANE_OPS, getLaneDisplayName } from '@/lib/trust/sourceLanes';
import '@/styles/motion.css';
import '@/styles/artifact-motion.css';
import '@/styles/spine-tabs.css';

export const metadata: Metadata = {
  title: 'The spine, as one section — design prototype',
  description:
    'Prototype: the four-step product argument (NPI, source evidence, the packet you choose, hospital review) collapsed into a single operable pane.',
  robots: { index: false, follow: false },
};

/** Plain-language explanation per lane, keyed by laneId (see the homepage
 *  ledger — same contract, same reason: rows derive from the registry so a
 *  dropped lane disappears rather than surviving as stale copy). */
const LANE_WHAT: Record<string, string> = {
  nppes_identity: 'The federal registry of every licensed provider.',
  oig_exclusions: 'The exclusion list every hospital must screen before a hire can bill.',
  pecos_enrollment: 'Medicare enrollment standing.',
  state_license: 'Your license standing with state medical and nursing boards.',
  employment_history: 'Where you have practiced, confirmed by the organizations themselves.',
  board_cert: 'Specialty certification from the relevant board.',
};

function laneState(lifecycle: string, cadence: string): { label: string; tone: string } {
  if (lifecycle === 'active' || lifecycle === 'partial') {
    return { label: `Available · ${cadence}`, tone: 'ok' };
  }
  if (lifecycle === 'planned') return { label: 'Access required', tone: 'gated' };
  return { label: 'Not yet connected', tone: 'off' };
}

/** The live lane ledger — real registry state, so no glass and no
 *  illustrative note. This is the one panel that is not a drawing. */
function LaneLedger() {
  return (
    <div className="ask-ledger-rows" data-spine-ledger="">
      {SOURCE_LANE_OPS.map((lane) => {
        const what = LANE_WHAT[lane.laneId];
        if (!what) return null;
        const state = laneState(lane.lifecycle, lane.cadenceLabel);
        return (
          <div
            key={lane.laneId}
            className="ask-ledger-row"
            data-lane-key={lane.statusApiKey}
            data-lane-lifecycle={lane.lifecycle}
          >
            <div className="ask-ledger-main">
              <span className="ask-ledger-name">{getLaneDisplayName(lane.laneId)}</span>
              <span className="ask-ledger-what">{what}</span>
            </div>
            <span className={`ask-ledger-state ask-ledger-state--${state.tone}`}>{state.label}</span>
          </div>
        );
      })}
    </div>
  );
}

const STEPS: readonly SpineStep[] = [
  {
    id: 'npi',
    step: 'Step 1',
    name: 'Start with your NPI',
    line: 'One number in. The federal screens run on you, in seconds.',
    panel: <CheckRunArtifact />,
    illustrative: true,
  },
  {
    id: 'evidence',
    step: 'Step 2',
    name: 'Source evidence',
    line: 'Six checks, each naming its source and how fresh the answer is.',
    // Real registry state — no illustrative note, no glass.
    panel: <LaneLedger />,
  },
  {
    id: 'packet',
    step: 'Step 3',
    name: 'The packet you choose',
    line: 'You decide which hospital sees it, and what it contains.',
    panel: (
      <figure className="vt-artifact vt-artifact--glass" style={{ margin: 0 }}>
        <PacketArtifact />
      </figure>
    ),
    illustrative: true,
  },
  {
    id: 'review',
    step: 'Step 4',
    name: 'Hospital review',
    line: 'Their reviewers inspect it claim by claim. Their committee still decides.',
    panel: <DecisionArtifact />,
    illustrative: true,
  },
] as const;

export default function SpinePrototypePage() {
  return (
    <main className="mz mz-paper min-h-screen">
      <SpineTabs
        eyebrow="Design prototype"
        title="Four steps, one pane."
        lede="The same argument the homepage makes across five sections and ~4,900px of scroll — as a single section a reader can operate. Pick a step; the pane shows that step's real surface."
        steps={STEPS}
      />
    </main>
  );
}

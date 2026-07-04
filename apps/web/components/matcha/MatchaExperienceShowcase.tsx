/**
 * MatchaExperienceShowcase — a public, honest preview of the signed-in MATCHA experience.
 *
 * Renders the REAL interactive components (constellation, daily brief, opportunity intelligence card)
 * with clearly-labeled SAMPLE data for a fictional clinician, so the signed-in experience can be seen
 * and QA'd without auth — and demoed to pilots/investors. Every sample is labeled as such; nothing
 * here asserts a real person's verified facts.
 */

import { DailyBriefView } from './MatchaDailyBrief';
import { MatchaConstellation } from './MatchaConstellation';
import { OpportunityIntelligenceCard, type IntelligenceExplanation, type IntelligenceOpportunity } from './OpportunityIntelligenceCard';
import { buildBriefItems, gapNudge } from '@/lib/matcha/daily';

const SAMPLE_ITEMS = buildBriefItems({
  newMatches: 4,
  savedMatches: 2,
  readinessScore: 78,
  readinessDelta: 6,
  completeness: 62,
  memoryNotes: ['You added Washington to where you want to work.'],
  gapNudge: gapNudge(62, 'Place'),
});

const SAMPLE_OPP: IntelligenceOpportunity = {
  id: 'sample-1',
  title: 'Cardiologist',
  organization: 'Bay Area Cardiac',
  location: 'Oakland, CA',
  state: 'CA',
  specialty: 'Cardiology',
  payRange: '$385k–$430k',
  hiringType: 'perm',
  remote: false,
};

const SAMPLE_EXPLANATION: IntelligenceExplanation = {
  matchBand: 'CLEAR',
  matchScore: 88,
  confidence: 0.9,
  fitReasons: [
    { label: 'California licensure on file', positive: true, dimension: 'eligibility' },
    { label: 'Cardiology specialty match', positive: true, dimension: 'specialty' },
    { label: 'Prefers California — this role is in Oakland', positive: true, dimension: 'location' },
    { label: 'Board certification due for a refresh', positive: false, dimension: 'credential' },
  ],
  missingCredentials: [],
  blockers: [],
  instantOfferEligible: true,
};

export function MatchaExperienceShowcase() {
  return (
    <div className="mz mz-paper" style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 96px', display: 'grid', gap: 24, minHeight: '100vh' }}>
      {/* Preview banner */}
      <div className="mz-inset" style={{ padding: '12px 16px', borderRadius: 4 }}>
        <span className="mz-mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--ink-500)' }}>
          Preview · sample clinician · this is what MATCHA looks like when it&rsquo;s yours
        </span>
      </div>

      {/* Greeting */}
      <div>
        <p className="mz-eyebrow">Your MATCHA</p>
        <h1 className="mz-display" style={{ marginTop: 12, fontSize: 34 }}>
          Welcome back, <span className="mz-accent">Dr. Rivera</span>.
        </h1>
        <p className="mz-lede" style={{ marginTop: 10 }}>MATCHA is 62% tuned to you. Here&rsquo;s what moved.</p>
      </div>

      {/* Daily brief — presentational, sample data, shown in its "new day" state */}
      <DailyBriefView streak={5} items={SAMPLE_ITEMS} isNewDay />

      {/* The personal constellation */}
      <div>
        <p className="mz-eyebrow" style={{ marginBottom: 10 }}>Your career, in motion</p>
        <MatchaConstellation height={440} profile={{ specialty: 'Cardiology', readinessScore: 78, matchCount: 4 }} />
        <p className="mz-mono" style={{ marginTop: 8, fontSize: 10, color: 'var(--ink-400)' }}>
          Drag to rotate · pull the slider to travel your career. Past &amp; future are projected; your real evidence lives in your wallet.
        </p>
      </div>

      {/* An opportunity intelligence card */}
      <div>
        <p className="mz-eyebrow" style={{ marginBottom: 10 }}>An opportunity MATCHA found</p>
        <OpportunityIntelligenceCard opportunity={SAMPLE_OPP} explanation={SAMPLE_EXPLANATION} />
      </div>

      {/* Honest footer + CTA to the real thing */}
      <div className="mz-card mz-card-pad" style={{ textAlign: 'center' }}>
        <p className="mz-body" style={{ margin: 0 }}>
          Signed in, this is built from <strong>your</strong> real evidence and live matches — not sample data.
        </p>
        <a href="/holder/matcha" className="mz-btn" style={{ marginTop: 14 }}>Let MATCHA work for you</a>
      </div>
    </div>
  );
}
